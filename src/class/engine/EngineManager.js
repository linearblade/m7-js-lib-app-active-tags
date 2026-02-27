/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * EngineManager
 * =============
 *
 * Policy and coordination layer for the Engine runtime.
 *
 * Role in the architecture
 * ------------------------
 * EngineManager owns all *management semantics* for the runtime:
 * - enqueue
 * - cancel
 * - lock / unlock
 * - ticket lookup
 *
 * It coordinates between:
 * - EngineState   (authoritative runtime state)
 * - Scheduler     (job-level runnable signaling)
 * - Engine        (job resolution + hooks)
 *
 * Clear separation of concerns:
 * - Does NOT own state maps (EngineState is the single source of truth).
 * - Does NOT perform execution/stepping (Tick owns stepping).
 * - Does NOT resolve scheduling order (Scheduler owns runnable policy).
 *
 * Conceptual Model
 * ----------------
 * EngineManager is the mutation boundary of the runtime.
 *
 * All ticket lifecycle transitions originate here:
 * - creation (enqueue)
 * - deduplication (alias model)
 * - cancellation
 * - lock transitions
 *
 * Execution (Tick/VM) consumes what EngineManager prepares.
 *
 * Alias Model
 * -----------
 * Tickets are deduplicated by (jobId + pipelineKey).
 * Each alias maps to at most one active ticket.
 * Enqueueing the same alias returns the existing ticket.
 *
 * Locking Model
 * -------------
 * - Locks are ticket-scoped.
 * - A locked ticket prevents scheduling of additional work for that jobKey.
 * - Unlocking may re-mark the job as runnable if work remains.
 *
 * Cancellation Model
 * ------------------
 * - Cancel removes the ticket from all indexes.
 * - Active tickets are transitioned out safely.
 * - Alias references are cleaned up defensively.
 *
 * Invariants
 * ----------
 * - EngineState is authoritative for ticket storage and alias tracking.
 * - Scheduler is only notified when a job becomes runnable.
 * - No execution is performed here.
 *
 * Design Posture
 * --------------
 * - Deterministic.
 * - Idempotent where possible.
 * - Defensive against stale aliases.
 * - No side-channel mutation of state maps.
 *
 * See also:
 * - EngineState   (runtime storage)
 * - Tick          (execution stepping)
 * - Scheduler     (runnable queue management)
 */

import helpers from './helpers.js';

export class EngineManager {

    /**
     * Create a new EngineManager instance.
     *
     * EngineManager is tightly bound to a single Engine instance and
     * operates as its policy and mutation coordinator.
     *
     * This constructor performs minimal validation and does not allocate
     * runtime state. All authoritative state is owned by EngineState,
     * accessible through the injected Engine.
     *
     * @param {Object} args
     * @param {Object} args.engine
     *   Required Engine instance.
     *   Provides access to:
     *   - engine.state
     *   - engine.scheduler
     *   - engine._resolveJob(...)
     *   - engine hooks
     *
     * @param {Object} [args.lib]
     *   Optional m7 utility library.
     *   Used for coercion, hashing, and defensive normalization.
     *
     * @throws {Error}
     *   If the required `engine` dependency is missing.
     *
     * @notes
     * - EngineManager does not own runtime maps or ticket storage.
     * - EngineManager does not perform stepping or execution.
     * - It is expected to be constructed once per Engine instance.
     */
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this.engine = engine;
	if (!this.engine) throw new Error("EngineManager requires { engine }");
    }

    // ---------------------------------------------------------------------------
    // Resolution helpers (delegates to engine)
    // ---------------------------------------------------------------------------

    /**
     * Resolve a job-like reference into a registered Job instance.
     *
     * Thin delegation to Engine._resolveJob().
     * EngineManager does not implement resolution semantics.
     *
     * @param {*} jobLike
     *   Reference accepted by the Engine’s job registry.
     *
     * @returns {Job|null}
     *   Resolved Job, or null if not found.
     */
    _resolveJob(jobLike) {
	return this.engine._resolveJob(jobLike);
    }

    /**
     * Resolve the active ticket id for a given (job, pipelineKey) alias.
     *
     * This is an internal helper that:
     * 1) Resolves `jobLike` into a Job via Engine.
     * 2) Normalizes the pipeline key (defaults to "default").
     * 3) Queries EngineState alias storage for an existing ticket id.
     *
     * Alias semantics:
     * - Each (jobId + pipelineKey) pair maps to at most one active ticket.
     * - Returns null if:
     *     - the job cannot be resolved
     *     - the job has no id
     *     - no active alias exists
     *
     * @param {*} jobLike
     *   Job reference accepted by the Engine’s resolver.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @returns {string|null}
     *   Active ticket id if present, otherwise null.
     */
    _resolveTicketId(jobLike, key = "default") {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) return null;
	const pipelineKey = String(key || "default");
	return this.engine.state.aliasGet(job.id, pipelineKey);
    }

    // ---------------------------------------------------------------------------
    // Management API (mirrors prior Engine methods)
    // ---------------------------------------------------------------------------

    /**
     * Retrieve active ticket(s) for a given job.
     *
     * This method supports two modes:
     *
     * 1) Specific pipeline key
     *    - When `key` is provided (string), resolves the single ticket
     *      associated with the (jobId + pipelineKey) alias.
     *    - Returns:
     *        - Ticket object if found
     *        - null if no active ticket exists
     *
     * 2) All pipelines
     *    - When `key` is undefined, returns all active tickets
     *      currently associated with the job.
     *    - Returns:
     *        - Array<Ticket> (possibly empty)
     *
     * Resolution flow:
     * - Resolve jobLike → Job
     * - Obtain per-job state bucket from EngineState
     * - Read alias map (pipelineKey → ticketId)
     * - Fetch Ticket objects from EngineState
     *
     * Failure semantics:
     * - If job cannot be resolved:
     *     - returns [] when key is undefined
     *     - returns null when key is specified
     *
     * - If job has no state entry:
     *     - same return behavior as above
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string|undefined} [key]
     *   Pipeline key. When omitted, all active tickets are returned.
     *
     * @returns {Ticket|null|Ticket[]}
     *   - Ticket when key is specified
     *   - null when key specified but not found
     *   - Array<Ticket> when key omitted
     */
    getTicketByJob(jobLike, key = undefined) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) return key === undefined ? [] : null;

	const st = this.engine.state.jobState(job.id);
	if (!st) return key === undefined ? [] : null;

	// CASE 1: key specified > single lookup via alias
	if (typeof key === "string") {
            const pipelineKey = String(key || "default");
            const ticketId = st.alias.get(pipelineKey);
            if (!ticketId) return null;
            return this.engine.state.getTicket(ticketId) || null;
	}

	// CASE 2: no key > return all active tickets for job
	const out = [];
	for (const ticketId of st.alias.values()) {
            const t = this.engine.state.getTicket(ticketId);
            if (t) out.push(t);
	}

	return out;
    }
    
    /**
     * Enqueue a ticket for a given (job, pipelineKey) alias.
     *
     * This is the primary ticket-creation entry point for the runtime.
     * Tickets are deduplicated by alias so that each (jobId + pipelineKey)
     * pair may have at most one active ticket at a time.
     *
     * Alias semantics
     * ---------------
     * - Alias key: (jobId + pipelineKey)
     * - If a ticket already exists for the alias, that existing ticket is returned.
     * - If the alias points at a missing ticket (stale id), the alias is cleared
     *   and a new ticket is created.
     *
     * Queueing semantics
     * ------------------
     * - A newly created ticket is:
     *   1) indexed in EngineState
     *   2) associated with the alias (aliasSet)
     *   3) pushed onto the per-job queue (st.queue)
     *
     * Runnable signaling
     * ------------------
     * After enqueueing, the job is marked runnable when:
     * - the job is not currently active, and
     * - the job is not locked
     *
     * Hooking
     * -------
     * If configured, `engine.hooks.onEnqueue({ job, ticket })` is invoked
     * after successful enqueue.
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for aliasing and ticket identity.
     *
     * @param {Object} [opts]
     * @param {Object} [opts.inputs]
     *   Optional runtime inputs attached to the ticket (event/interval/request context).
     *
     * @param {number} [opts.priority=0]
     *   Optional scheduling priority recorded on the ticket.
     *   (Ordering behavior is determined by Scheduler/Tick policy.)
     *
     * @param {Object} [opts.meta={}]
     *   Optional metadata attached to the ticket for diagnostics and tracing.
     *
     * @param {boolean} [opts.returnMeta=false]
     *   When true, returns enqueue metadata object:
     *   `{ ticket, created }`.
     *   `created` is true only when a new ticket record was created.
     *
     * @returns {Ticket|{ticket: Ticket, created: boolean}}
     *   Default return is Ticket (existing or newly created).
     *   When `opts.returnMeta` is true, returns `{ ticket, created }`.
     *
     * @throws {Error}
     *   If `jobLike` cannot be resolved into a Job with a valid `id`.
     */
    enqueue(jobLike, key = "default", { inputs, priority = 0, meta = {}, returnMeta = false } = {}) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) throw new Error("EngineManager.enqueue requires a resolved job with id");
	const withMeta = !!returnMeta;

	const jobId = job.id;
	const pipelineKey = String(key || "default");

	const st = this.engine.state.jobState(jobId);

	// Dedupe via alias: (jobId + pipelineKey) -> ticketId
	const existingId = st.alias.get(pipelineKey);
	if (existingId) {
	    const existing = this.engine.state.getTicket(existingId);
	    if (existing) return withMeta ? { ticket: existing, created: false } : existing;
	    st.alias.delete(pipelineKey); // stale alias
	}

	const ticket = helpers.makeRunTicket({job, pipelineKey, inputs, priority, meta });
	//console.log(ticket);
	this.engine.state.indexTicket(jobId, ticket);
	this.engine.state.aliasSet(jobId, pipelineKey, ticket.id);

	st.queue.push(ticket);

	// Mark runnable if not currently running and not locked
	if (!st.active && !this.engine.state.isLockedJobId(jobId)) {
	    this.engine.scheduler.markRunnable(jobId);
	}

	if (this.engine.hooks.onEnqueue) this.engine.hooks.onEnqueue({ job, ticket });
	return withMeta ? { ticket, created: true } : ticket;
    }

    // --- locking (tickets are the unique runner)

    /**
     * Apply or update a lock on a specific ticket.
     *
     * Lock semantics
     * --------------
     * - A lock is an opaque object attached to `ticket.lock`.
     * - The presence of a lock indicates the ticket is protected
     *   from certain scheduling or execution transitions
     *   (exact behavior enforced elsewhere in the runtime).
     *
     * Behavior
     * --------
     * - If the ticket record does not exist, this is a no-op and returns 0.
     * - If `lock` is provided, it is assigned directly to `ticket.lock`.
     * - If `lock` is omitted, a default lock object is created:
     *     { type: "ticket", token: "ltk_<timestamp>" }
     *
     * This method does not:
     * - validate lock structure
     * - enforce lock policy
     * - notify scheduler
     *
     * It only mutates ticket state.
     *
     * @param {string} ticketId
     *   Id of the ticket to lock.
     *
     * @param {Object} [lock]
     *   Optional lock descriptor object.
     *
     * @returns {number}
     *   1 if the ticket was found and mutated,
     *   0 if no matching ticket exists.
     */
    lockTicket(ticketId, lock) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	rec.ticket.lock = lock || { type: "ticket", token: `ltk_${Date.now()}` };
	return 1;
    }

    /**
     * Apply a lock to the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `lockTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Applies a lock to that ticket if present.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op.
     * - Locking does not create tickets.
     *
     * Default lock behavior
     * ---------------------
     * - If `lock` is not provided, a default lock object is created:
     *     { type: "jobKey", token: "ljk_<timestamp>" }
     *
     * This method does not:
     * - validate lock structure
     * - enforce lock semantics
     * - notify the scheduler directly
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @param {Object} [lock]
     *   Optional lock descriptor object.
     *
     * @returns {number}
     *   1 if a ticket was found and locked,
     *   0 if no active ticket exists for the alias.
     */
    lock(jobLike, key = "default", lock) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.lockTicket(ticketId, lock || { type: "jobKey", token: `ljk_${Date.now()}` });
    }

    /**
     * Remove a lock from a specific ticket.
     *
     * Unlock semantics
     * ----------------
     * - If the ticket does not exist, this is a no-op and returns 0.
     * - If the ticket has no lock, this is treated as already unlocked and returns 1.
     * - If a `token` is provided and does not match the ticket’s lock token,
     *   the unlock attempt is rejected and returns 0.
     *
     * On successful unlock:
     * - `ticket.lock` is cleared.
     * - If the associated job still has work (active or queued),
     *   the Scheduler is signaled via `markRunnable(jobId)` so it may resume.
     *
     * This method does not:
     * - validate lock structure
     * - guarantee immediate execution
     * - modify alias mappings
     *
     * @param {string} ticketId
     *   Id of the ticket to unlock.
     *
     * @param {string} [token]
     *   Optional lock token. When provided, must match `ticket.lock.token`
     *   to authorize unlock.
     *
     * @returns {number}
     *   1 if unlock succeeded or ticket was already unlocked,
     *   0 if ticket not found or token mismatch.
     */
    unlockTicket(ticketId, token) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const t = rec.ticket;
	if (!t.lock) return 1;

	// token optional; if provided, must match
	if (token && t.lock.token && token !== t.lock.token) return 0;

	t.lock = null;

	// if this job has work, allow scheduler to pick it up again
	const st = this.engine.state.jobs.get(rec.jobId);
	if (st && (st.active || st.queue.length)) this.engine.scheduler.markRunnable(rec.jobId);

	return 1;
    }

    /**
     * Remove a lock from the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `unlockTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Attempts to remove the lock from that ticket.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op and returns 0.
     * - Unlocking does not create tickets.
     *
     * Token semantics
     * ---------------
     * - If a `token` is provided, it must match the ticket’s lock token.
     * - If no token is provided, any existing lock is cleared.
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @param {string} [token]
     *   Optional lock token required to authorize unlock.
     *
     * @returns {number}
     *   1 if unlock succeeded or ticket was already unlocked,
     *   0 if no active ticket exists or token mismatch occurred.
     */
    unlock(jobLike, key = "default", token) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.unlockTicket(ticketId, token);
    }

    // --- cancel

    /**
     * Cancel the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `cancelTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Cancels that ticket if present.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op and returns 0.
     * - Cancellation removes the ticket from runtime state and alias mappings.
     *
     * This method does not:
     * - create tickets
     * - throw on missing jobs
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @returns {number}
     *   1 if a ticket was found and cancelled,
     *   0 if no active ticket exists for the alias.
     */
    cancel(jobLike, key = "default") {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.cancelTicket(ticketId);
    }

    /**
     * Cancel a ticket by id and remove it from all runtime indexes.
     *
     * Cancellation is a destructive state operation:
     * - The ticket is removed from the global ticket index.
     * - If the ticket is active or queued for its job, it is removed there as well.
     * - Alias mappings are cleaned up defensively to avoid stale pointers.
     *
     * Runtime semantics
     * -----------------
     * - If the ticket record does not exist, returns 0 (no-op).
     * - The global ticket index is always cleared first (`deleteTicket(ticketId)`).
     *
     * Active ticket behavior
     * ----------------------
     * - If the ticket is currently active for the job:
     *   - the alias (jobId + pipelineKey) is cleared if it points to this ticket
     *   - the ticket state is marked `helpers.TICKET_STATE.ERROR` (terminalization marker)
     *   - the job's active slot is cleared
     *   - if queued work remains and the job is not locked, the Scheduler is
     *     signaled via `markRunnable(jobId)`
     *
     * Queued ticket behavior
     * ----------------------
     * - If the ticket is present in the job queue:
     *   - it is removed from the queue
     *   - alias mapping is cleared if it points to this ticket
     *
     * Stale record behavior
     * ---------------------
     * - If the ticket is not found in active or queued slots, the global index
     *   was stale relative to the per-job structures.
     * - Best-effort alias cleanup is still performed when a pipelineKey is known.
     *
     * Notes
     * -----
     * - Cancellation does not attempt to "abort" an executing VM step. It only
     *   removes scheduler visibility and clears state references.
     * - Marking an active ticket `helpers.TICKET_STATE.ERROR` is a deliberate terminal marker to
     *   prevent accidental reuse in downstream logic.
     *
     * @param {string} ticketId
     *   Id of the ticket to cancel.
     *
     * @returns {number}
     *   1 if the ticket was found (or cleaned up best-effort),
     *   0 if no matching ticket record exists.
     */
    cancelTicket(ticketId) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const { jobId, ticket } = rec;
	const st = this.engine.state.jobs.get(jobId);

	// Always clear global ticket index
	this.engine.state.deleteTicket(ticketId);

	if (!st) return 1;

	// Active
	if (st.active && st.active.id === ticketId) {
	    if (st.active.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, st.active.pipelineKey, ticketId);
	    }

	    st.active.state = helpers.TICKET_STATE.ERROR;
	    st.active = null;

	    if (st.queue.length && !this.engine.state.isLockedJobId(jobId)) {
		this.engine.scheduler.markRunnable(jobId);
	    }
	    return 1;
	}

	// Queued
	const before = st.queue.length;
	st.queue = st.queue.filter(x => x.id !== ticketId);

	if (st.queue.length !== before) {
	    if (ticket && ticket.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	    }
	    return 1;
	}

	// If it wasn't in active/queue, index was stale; alias cleanup if possible
	if (ticket && ticket.pipelineKey) {
	    this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	}
	return 1;
    }
}

export default EngineManager;
