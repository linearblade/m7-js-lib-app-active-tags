import helpers from './helpers.js';
import TickResponse from './TickResponse.js';

export class Tick {
    constructor({ lib, engine }) {
        this.lib = lib;
        this.engine = engine;
	this.response = new TickResponse({lib});
    }
    
    /**
     * Advance the engine by ONE stage step globally.
     * Picks the next runnable job from the scheduler, advances that job's ACTIVE ticket by one step.
     *
     * Returns a small trace object for debugging/tests.
     */
    async tick({ ctx = {} ,ticket=null} = {}) {
        const v = this._validateTick({ ctx, ticket });
        if (v.done) return v.res;

        const finalize = this._makeFinalize(v);

        let res;
        try {
            res = await this.engine.vm.step({ job: v.job, ticket: v.ticket, ctx: v.ctx});
        } catch (err) {
	    console.warn('trap an error');
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

	this._emitHook("onStage", stageTrace);

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
            if (ticket.pipelineKey && (finalState === "complete" || finalState === "error")) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
            }
	    
	};
    }
    _oldmakeFinalize(env) {
        const { jobId, st, ticket } = env;

        return (finalState) => {
            ticket.state = finalState;
            // drop active
            st.active = null;

            // clear ticket index
            this.engine.state.deleteTicket(ticket.id);

            // clear alias mapping for this pipelineKey IF it points to this ticket
            if (ticket.pipelineKey) {
                this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
            }

            st.stats.lastRunAt = Date.now();

	    // only clear alias on terminal states
	    //if (ticket.pipelineKey && (finalState === "complete" || finalState === "error")) {
	    //this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
	    //}
            // if more queued work exists, keep job runnable
            if (st.queue.length && !this.engine.state.isLockedJobId(jobId)) {
		this.engine.scheduler.markRunnable(jobId);
            }
        };
    }

    _validateTick({  ctx = {},ticket=null } = {}) {
	return ticket ?
	    this._validateTickNamed({ctx,ticket}):
	    this._validateTickNext({ctx});
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
			ticketId,
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
            this._emitHook("onDequeue", tr);

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
            this._emitHook("onDequeue", tr);

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
    _makeMissingJob({ jobId, ticketId, missingJobFlag = false } = {}) {
	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		ticketId,
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
	if (!ticket)  return;

        const ticketId = (typeof ticket === "string") ? ticket : ticket.id;
        if (!ticketId) {
	    return { done: true, res: this.response._makeTickTrace({
                flags: { didWork: false, reason: "badTicketArg" }
	    }) };
        }

        const rec = this.engine.state.getTicketRec(ticketId);
        if (!rec || !rec.jobId || !rec.ticket) {
	    return { done: true, res: this.response._makeTickTrace({
                ticketId,
                flags: { didWork: false, reason: "missingTicket" }
	    }) };
        }

        const jobId = rec.jobId;

	const job = this._resolveJobSafe(jobId);
	if (!job || !job.id) 
	    return this._makeMissingJob({ jobId, ticketId });

        const st = this.engine.state.jobState(jobId);

        // If some OTHER ticket is active, do not steal the job mid-run
        if (st.active && st.active.id !== ticketId) {
	    return { done: true, res: this.response._makeTickTrace({
                jobId, job, ticketId,
                flags: { didWork: false, reason: "differentActiveTicket" }
	    }) };
        }


	const ensured = this._ensureActiveTicket({ st, jobId, job, ticketId });
	if (ensured?.done) return ensured;

        // Lock checks (match your global behavior)
	const blocked = this._isJobBlocked({ jobId, job, ticket: st.active });
	if (blocked) return blocked;

	const tBlocked = this._isTicketBlocked({ jobId, job, ticket: st.active });
	if (tBlocked) return tBlocked;

        st.active.state = "running";
	return this._makeRunnable({ jobId, job, st, ticket: st.active, ctx });
    }
    
    _validateTickNext({ ctx = {} } = {}) {
        const jobId = this.engine.scheduler.nextRunnable();
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
        ticket.state = "running";
	// no need to tick trace b/c done = false means we continue. done = true means. 'were done'
	return this._makeRunnable({ jobId, job, st, ticket, ctx });
    }


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
	ticket.state = "wait";
	ticket.lock = res.lock || res.await || { type: "wait", token: `aw_${Date.now()}` };

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, waiting: true }
	});
    }

    _responseError(env) {
	const { jobId, job, ticket, res, st, finalize } = env;
	st.stats.errors += 1;
	finalize("error");

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: "error" });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, error: true }
	});

	// uniform terminal hooks (same payload)
	this._emitHook("onError", trace);
	this._emitHook("onTicketDone", trace);

	return trace;
    }

    _responseComplete(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	st.stats.runs += 1;
	finalize("complete");

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: "complete" });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, complete: true }
	});
	this.lib.hash.set(job,"flags.hasRun", true);
	// uniform terminal hooks (same payload)
	this._emitHook("onComplete", trace);
	this._emitHook("onTicketDone", trace);

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
	finalize("error");



	const summary = this.response._makeTerminalSummary({ job, ticket, res: sr, state: "error" });

	const trace = this.response._makeTickTrace({
            jobId,
            job,
            ticket,
            res: sr,
            summary,
            flags: { didWork: true, terminal: true, error: true, reason: "unknownStatus" },
	});

	// Uniform terminal hooks
	this._emitHook("onError", trace);
	this._emitHook("onTicketDone", trace);

	return trace;
    }
}

export default Tick;
