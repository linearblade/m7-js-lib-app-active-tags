/**
 * Tick
 * ----
 * Single-step execution driver for the Engine.
 *
 * Role
 * - Advances the Engine by exactly ONE stage transition.
 * - Selects a runnable job via Scheduler (or targets a specific ticket).
 * - Ensures correct promotion of queued tickets to active.
 * - Enforces job-level and ticket-level locking.
 * - Delegates stage execution to the VM.
 * - Emits standardized hook traces via TickResponse.
 *
 * Conceptual model
 * - Engine is the façade.
 * - EngineState owns authoritative runtime state.
 * - EngineManager owns enqueue/lock/cancel policy.
 * - Scheduler selects runnable jobs.
 * - VM executes one pipeline stage.
 * - Tick orchestrates the above for one atomic step.
 *
 * Execution modes
 * 1) Next-runnable mode (default)
 *    - Pull next jobId from Scheduler.
 *    - Promote queued ticket to active (if needed).
 *    - Execute exactly one stage.
 *
 * 2) Targeted mode (ticket specified)
 *    - Validate the specific ticket id.
 *    - Ensure it is the active ticket (or promote it).
 *    - Execute exactly one stage for that ticket only.
 *
 * Invariants
 * - At most one ACTIVE ticket per job.
 * - A locked job or locked ticket will not execute.
 * - A single call to `tick()` never loops; it advances only one stage.
 * - Terminal transitions (complete/error) clear active state and aliases.
 *
 * Hooks
 * - onDequeue      : when a ticket is promoted from queue → active
 * - onStage        : after every VM step (non-terminal or transition)
 * - onComplete     : when a ticket reaches terminal complete
 * - onError        : when a ticket reaches terminal error
 * - onTicketDone   : uniform terminal hook (complete or error)
 *
 * Trace contract
 * - All outward-facing responses are normalized via TickResponse.
 * - Returned value from `tick()` is always a trace object.
 *
 * Non-responsibilities
 * - Does not enqueue tickets (EngineManager does that).
 * - Does not maintain indexes (EngineState does that).
 * - Does not decide scheduling policy (Scheduler does that).
 * - Does not interpret pipeline semantics (VM does that).
 *
 * This class is the deterministic execution spine of the runtime.
 */

import helpers from './helpers.js';
import TickResponse from './TickResponse.js';

export class Tick {
    constructor({ lib, engine }) {
        this.lib = lib;
        this.engine = engine;
	this.response = new TickResponse({lib});
    }
    
/**
 * Advance the Engine by exactly ONE stage transition.
 *
 * This is the primary execution entry point for the runtime loop.
 * Each call to `tick()` performs at most one VM stage step and
 * returns a normalized trace object describing what happened.
 *
 * Modes of operation
 * ------------------
 * 1) Global mode (default)
 *    - Scheduler selects the next runnable job.
 *    - That job’s ACTIVE ticket (or head of queue) is advanced by one stage.
 *
 * 2) Targeted mode (`ticket` provided)
 *    - Only the specified ticket is advanced.
 *    - Scheduler selection is bypassed.
 *
 * Execution flow
 * --------------
 * 1) Validate and resolve execution context via `_validateTick`.
 *    - May early-return if nothing is runnable.
 *
 * 2) Execute exactly one VM step:
 *        engine.vm.step({ job, ticket, ctx })
 *    - Errors are trapped and converted into a StageResult-like error.
 *
 * 3) Record last result on the ticket (`ticket.last`).
 *
 * 4) Emit `HOOKS.STAGE` after every VM step
 *    - Fired for all outcomes (OK, WAIT, ERROR, COMPLETE).
 *    - Includes terminal transitions.
 *
 * 5) Dispatch to a response handler based on `res.status`:
 *        OK        → `_responseOk`
 *        WAIT      → `_responseWait`
 *        ERROR     → `_responseError`
 *        COMPLETE  → `_responseComplete`
 *        (unknown) → `_responseUnknown`
 *
 * 6) Return a normalized TickResponse trace object.
 *
 * Guarantees
 * ----------
 * - Never advances more than one stage per call.
 * - Never throws VM errors outward; they are normalized.
 * - Always returns a trace object.
 * - Maintains Engine invariants (one active ticket per job).
 *
 * Non-responsibilities
 * --------------------
 * - Does not enqueue tickets (EngineManager handles that).
 * - Does not choose scheduling policy (Scheduler handles that).
 * - Does not mutate configuration.
 *
 * @param {Object} [args]
 * @param {Object} [args.ctx={}]
 *   Optional execution context passed through to VM and ops.
 *
 * @param {string|null} [args.ticket=null]
 *   Optional ticket id for targeted execution.
 *
 * @returns {Promise<Object>}
 *   Normalized tick trace describing the outcome of this step.
 */
    async tick({ ctx = {}, ticket = null, requireJob = undefined } = {}) {
        const v = this._validateTick({ ctx, ticket, requireJob });
        if (v.done) return v.res;

        const finalize = this._makeFinalize(v);

        let res;
        try {
            res = await this.engine.vm.step({ job: v.job, ticket: v.ticket, ctx: v.ctx});
        } catch (err) {
	    //console.warn('trap an error');
	    res = helpers.SR_error(err, { pipelineKey: v.ticket?.pipelineKey || null });
            //res = { status: helpers.STAGE_STATUS.ERROR, error: err };
        }
	//console.log(res);
	v.ticket.last = { at: Date.now(), res };
	// build a non-terminal trace for stage events (even if it's a transition OK)
	this._emitOnStage({v,res});
        const env = { ...v, res, finalize };

        const disp = {
            [helpers.STAGE_STATUS.OK]: this._responseOk,
            [helpers.STAGE_STATUS.WAIT]: this._responseWait,
            [helpers.STAGE_STATUS.ERROR]: this._responseError,
            [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
        };

        const handler = disp[res?.status] || this._responseUnknown;
        return handler.call(this, env);
    }
    // best-effort invoke hook; never throws
    _emitHook(name, trace) {
	const fn = this.engine?.hooks?.[name];
	if (typeof fn === "function") fn(trace);
    }
    
    _emitOnStage({v,res}){
	const stageTrace = this.response._makeTickTrace({
	    jobId: v.jobId,
	    job: v.job,
	    ticket: v.ticket,
	    res,
	    summary: null,
	    flags: {
		didWork: true,
		ok: res?.status === helpers.STAGE_STATUS.OK,
		waiting: res?.status === helpers.STAGE_STATUS.WAIT,
		error: res?.status === helpers.STAGE_STATUS.ERROR,
		complete: res?.status === helpers.STAGE_STATUS.COMPLETE,
	    }
	});

	this._emitHook(helpers.HOOKS.STAGE, stageTrace);

    }

    _makeFinalize(env) {
	const { jobId, st, ticket } = env;

	return (finalState) => {
            ticket.state = finalState;

            // drop active
            st.active = null;

            // clear ticket index
            this.engine.state.deleteTicket(ticket.id);

            st.stats.lastRunAt = Date.now();

            // only clear alias on terminal states
            if (ticket.pipelineKey && (finalState === helpers.TICKET_STATE.COMPLETE || finalState === helpers.TICKET_STATE.ERROR)) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
            }
	    
	};
    }

    /**
     * Validate and prepare execution context for a tick.
     *
     * This method determines which execution path to take:
     *
     * - Targeted mode:
     *     If `ticket` is provided, delegates to `_validateTickNamed`
     *     to resolve and validate that specific ticket.
     *
     * - Global mode:
     *     If `ticket` is not provided, delegates to `_validateTickNext`
     *     to select the next runnable job/ticket via the Scheduler.
     *
     * Responsibilities
     * ----------------
     * - Normalize incoming arguments.
     * - Resolve job and ticket context.
     * - Enforce basic invariants (existence, active state, locks).
     * - Produce a standardized validation object consumed by `tick()`.
     *
     * Return contract
     * ---------------
     * Returns a validation object of shape:
     *
     *   {
     *     done: boolean,   // true if no execution should occur
     *     res: Object,     // trace to return immediately if done === true
     *     job: Job,        // resolved job (when done === false)
     *     ticket: Object,  // resolved active ticket
     *     ctx: Object      // normalized execution context
     *   }
     *
     * - If `done === true`, `tick()` must immediately return `res`.
     * - If `done === false`, the returned job/ticket are safe to execute.
     *
     * This method does not execute any VM logic.
     *
     * @param {Object} [args]
     * @param {Object} [args.ctx={}]
     *   Optional execution context passed through to VM.
     *
     * @param {string|null} [args.ticket=null]
     *   Optional ticket id for targeted execution.
     *
     * @returns {Object}
     *   Validation descriptor for the current tick.
     */
    _validateTick({ ctx = {}, ticket = null, requireJob = undefined } = {}) {
	return ticket ?
	    this._validateTickNamed({ ctx, ticket }):
	    this._validateTickNext({ ctx, requireJob });
    }

    /**
     * Safely resolve a job by id using Engine resolution semantics.
     *
     * This is a consolidation helper that preserves the exact behavior
     * previously duplicated in Tick:
     *  1) Attempt engine._resolveJob(jobId)
     *  2) Fallback to engine._resolveJob({ id: jobId })
     *  3) Swallow resolution errors and return null if unresolved
     *
     * No validation, logging, or side effects are performed here.
     * Callers are responsible for handling missing jobs.
     *
     * @param {string} jobId
     * @returns {Object|null} Resolved job or null if not found
     */
    _resolveJobSafe(jobId) {
	let job = null;
	try {
            job = this.engine._resolveJob(jobId);
	} catch (e1) {
            try { job = this.engine._resolveJob({ id: jobId }); }
            catch (e2) { job = null; }
	}
	return (job && job.id) ? job : null;
    }

    /**
     * Check whether a job is currently locked.
     * Returns a completed tick result if blocked, otherwise null.
     *
     * Caller controls trace shape (ticket inclusion, etc).
     */
    _isJobBlocked({ jobId, job, ticket } = {}) {
	if (!this.engine.state.isLockedJobId(jobId)) return null;

	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		ticket,
		flags: { didWork: false, locked: true, reason: "jobLocked" }
            })
	};
    }

    /**
     * Check whether a ticket is locked and not expired.
     * Clears expired locks.
     * Returns a completed tick result if blocked, otherwise null.
     */
    _isTicketBlocked({ jobId, job, ticket } = {}) {
	if (!ticket || !ticket.lock) return null;

	if (this.engine.state.isExpired(ticket.lock)) {
            ticket.lock = null;
            return null;
	}

	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		ticket,
		flags: { didWork: false, locked: true, reason: "ticketLocked" }
            })
	};
    }

    /**
     * Promote a queued ticket to active if none is active.
     *
     * If ticketId is provided, attempts to promote that specific ticket
     * from the queue (targeted mode).
     *
     * Returns:
     *  - { ticket } on success
     *  - { done, res } if promotion fails in targeted mode
     *  - null if no promotion occurred and no error
     */
    _promoteToActive({ st, jobId, job, ticketId } = {}) {
	if (st.active) return { ticket: st.active };

	// Targeted mode: find specific ticket
	if (ticketId) {
            const idx = st.queue.findIndex(x => x && x.id === ticketId);
            if (idx < 0) {
		return {
                    done: true,
                    res: this.response._makeTickTrace({
			jobId,
			job,
			ticket: this.engine.state.getTicket(ticketId) ,
			flags: { didWork: false, reason: "ticketNotRunnable" }
                    })
		};
            }

            st.active = st.queue.splice(idx, 1)[0];

            const tr = this.response._makeTickTrace({
		jobId,
		job,
		ticket: st.active,
		flags: { didWork: false, reason: "dequeueTarget" }
            });
            this._emitHook(helpers.HOOKS.DEQUEUE, tr);

            return { ticket: st.active };
	}

	// Next-runnable mode: shift from queue
	st.active = st.queue.shift() || null;

	if (st.active) {
            const tr = this.response._makeTickTrace({
		jobId,
		job,
		ticket: st.active,
		flags: { didWork: false, reason: "dequeue" }
            });
            this._emitHook(helpers.HOOKS.DEQUEUE, tr);

            return { ticket: st.active };
	}

	return null;
    }

    /**
     * Ensure st.active is set for this job.
     * - If st.active already exists: returns { ticket: st.active }
     * - Otherwise attempts promotion via _promoteToActive(...)
     * - In targeted mode (ticketId provided), may return { done, res } on failure
     * - In next mode, if still no active ticket, returns { done, res } with reason "empty"
     */
    _ensureActiveTicket({ st, jobId, job, ticketId } = {}) {
	// already active
	if (st.active) return { ticket: st.active };

	// try promote (may return {done,res} in targeted mode)
	const promoted = this._promoteToActive({ st, jobId, job, ticketId });
	if (promoted?.done) return promoted;

	// after promotion attempt, if we have active, return it
	if (st.active) return { ticket: st.active };

	// non-targeted mode: empty queue -> no active
	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		flags: { didWork: false, empty: true, reason: "empty" }
            })
	};
    }

    _makeRunnable({ jobId, job, st, ticket, ctx } = {}) {
	return { done: false, jobId, job, st, ticket, ctx };
    }

    /**
     * Build a standardized "missing job" tick result.
     * Preserves existing flag differences between named and next modes.
     */
    _makeMissingJob({ jobId, ticket, missingJobFlag = false } = {}) {
	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		ticket: ticket? this.engine.state.getTicket(ticket) || ticket : null,
		flags: {
                    didWork: false,
                    ...(missingJobFlag ? { missingJob: true } : {}),
                    reason: "missingJob"
		}
            })
	};
    }
    
    _validateTickNamed({ ctx = {}, ticket = null } = {}) {
	
	// -----------------------------------------------------------------
	// Targeted mode: tick a specific ticket id (or ticket object)
	// -----------------------------------------------------------------
	if (!ticket)  return {
	    done: true,
	    res: this.response._makeTickTrace({
		flags: { didWork: false, reason: "badTicketArg" }
	    })
	};

        const ticketId = (typeof ticket === "string") ? ticket : ticket.id;
        if (!ticketId) {
	    return { done: true, res: this.response._makeTickTrace({
                flags: { didWork: false, reason: "badTicketArg" }
	    }) };
        }

        const rec = this.engine.state.getTicketRec(ticketId);
        if (!rec || !rec.jobId || !rec.ticket) {
	    return { done: true, res: this.response._makeTickTrace({
                ticket: rec?.ticket || this.engine.state.getTicket(ticketId) || null ,
                flags: { didWork: false, reason: "missingTicket" }
	    }) };
        }

        const jobId = rec.jobId;

	const job = this._resolveJobSafe(jobId);
	if (!job || !job.id)
	    return this._makeMissingJob({
		jobId,
		ticket: rec?.ticket || this.engine.state.getTicket(ticketId) || null
	    });

        const st = this.engine.state.jobState(jobId);

        // If some OTHER ticket is active, do not steal the job mid-run
	
        if (st.active && st.active.id !== ticketId) {
	    return {
		done: true,
		res: this.response._makeTickTrace({
		    jobId,
		    job,
		    ticket: st.active,
		    flags: { didWork: false, reason: "differentActiveTicket" }
		})
	    };
        }


	const ensured = this._ensureActiveTicket({ st, jobId, job, ticketId });
	if (ensured?.done) return ensured;

        // Lock checks (match your global behavior)
	const blocked = this._isJobBlocked({ jobId, job, ticket: st.active });
	if (blocked) return blocked;

	const tBlocked = this._isTicketBlocked({ jobId, job, ticket: st.active });
	if (tBlocked) return tBlocked;

        st.active.state = helpers.TICKET_STATE.RUNNING;
	return this._makeRunnable({ jobId, job, st, ticket: st.active, ctx });
    }
    
    _validateTickNext({ ctx = {}, requireJob = undefined } = {}) {
        const jobId = this.engine.scheduler.nextRunnable({ requireJob });
        if (!jobId)
            return { done: true, res: this.response._makeTickTrace({ flags: { didWork: false, reason: "noRunnable" } }) };
	
	// Resolve job (jobId is the stringified identity) 
	const job = this._resolveJobSafe(jobId);
	if (!job || !job.id) 
	    return this._makeMissingJob({ jobId, missingJobFlag: true });
	

        // If active ticket is locked, do not run this job now
	const blocked = this._isJobBlocked({ jobId, job });
	if (blocked) return blocked;
	

        const st = this.engine.state.jobState(jobId);

	
	// Ensure there is an active ticket (one active per job)
	const ensured = this._ensureActiveTicket({ st, jobId, job });
	if (ensured?.done) return ensured;
	const ticket = ensured.ticket; // or st.active
	
        // If ticket is locked, do not run
	const tBlocked = this._isTicketBlocked({ jobId, job, ticket });
	if (tBlocked) return tBlocked;
        ticket.state = helpers.TICKET_STATE.RUNNING;
	// no need to tick trace b/c done = false means we continue. done = true means. 'were done'
	return this._makeRunnable({ jobId, job, st, ticket, ctx });
    }


    // -------------------------------------
    // _response*() — mutates ticket state + emits terminal hooks; returns TickResponse trace
    // -------------------------------------
    
    _responseOk(env) {
	const { jobId, job, ticket, res } = env;
	this.engine.scheduler.markRunnable(jobId);

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, ok: true }
	});
    }

    _responseWait(env) {
	const { jobId, job, ticket, res } = env;
	ticket.state = helpers.TICKET_STATE.WAIT;
	ticket.lock = res.lock || res.await || { type: "wait", token: `aw_${Date.now()}` };

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, waiting: true }
	});
    }

    _responseError(env) {
	const { jobId, job, ticket, res, st, finalize } = env;
	st.stats.errors += 1;
	finalize(helpers.TICKET_STATE.ERROR);

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: helpers.TICKET_STATE.ERROR });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, error: true }
	});
	// uniform terminal hooks (same payload)
	this._emitHook(helpers.HOOKS.ERROR, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }

    _responseComplete(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	st.stats.runs += 1;
	finalize(helpers.TICKET_STATE.COMPLETE);

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: helpers.TICKET_STATE.COMPLETE});

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, complete: true }
	});
	this.lib.hash.set(job,"flags.hasRun", true);
	// uniform terminal hooks (same payload)
	this._emitHook(helpers.HOOKS.COMPLETE, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }

    _responseUnknown(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	const err = new Error(`Unknown stage status '${res?.status}'`);
	const sr = helpers.SR_error(err, {
            pipelineKey: res?.detail?.pipelineKey || ticket?.pipelineKey || null,
            phase: ticket?.phase || null,
            unknownStatus: res?.status,
            original: ticket?.errorInfo || null,
	});
	st.stats.errors += 1;
	//always hard fail on things that should exist but dont
	finalize(helpers.TICKET_STATE.ERROR);



	const summary = this.response._makeTerminalSummary({ job, ticket, res: sr, state: helpers.TICKET_STATE.ERROR });

	const trace = this.response._makeTickTrace({
            jobId,
            job,
            ticket,
            res: sr,
            summary,
            flags: { didWork: true, terminal: true, error: true, reason: "unknownStatus" },
	});

	// Uniform terminal hooks
	this._emitHook(helpers.HOOKS.ERROR, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }
}

export default Tick;
