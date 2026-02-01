// -----------------------------------------------------------------------------
// EngineManager (management arm)
// - Owns policy + coordination (enqueue/cancel/lock/unlock)
// - Does NOT own state maps (engine.state owns jobs/tickets/alias)
// - Does NOT own execution (Tick owns stepping)
// -----------------------------------------------------------------------------

import helpers from './helpers.js';

export class EngineManager {
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this.engine = engine;
	if (!this.engine) throw new Error("EngineManager requires { engine }");
    }

    // ---------------------------------------------------------------------------
    // Resolution helpers (delegates to engine)
    // ---------------------------------------------------------------------------

    _resolveJob(jobLike) {
	return this.engine._resolveJob(jobLike);
    }

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
     * Enqueue a ticket for (job + pipelineKey), deduping by alias.
     * Returns the existing ticket if already enqueued for that alias.
     */
    enqueue(jobLike, key = "default", { inputs, priority = 0, meta = {} } = {}) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) throw new Error("EngineManager.enqueue requires a resolved job with id");

	const jobId = job.id;
	const pipelineKey = String(key || "default");

	const st = this.engine.state.jobState(jobId);

	// Dedupe via alias: (jobId + pipelineKey) -> ticketId
	const existingId = st.alias.get(pipelineKey);
	if (existingId) {
	    const existing = this.engine.state.getTicket(existingId);
	    if (existing) return existing;
	    st.alias.delete(pipelineKey); // stale alias
	}

	const ticket = helpers.makeRunTicket({ jobId, pipelineKey, inputs, priority, meta });

	this.engine.state.indexTicket(jobId, ticket);
	this.engine.state.aliasSet(jobId, pipelineKey, ticket.id);

	st.queue.push(ticket);

	// Mark runnable if not currently running and not locked
	if (!st.active && !this.engine.state.isLockedJobId(jobId)) {
	    this.engine.scheduler.markRunnable(jobId);
	}

	if (this.engine.hooks.onEnqueue) this.engine.hooks.onEnqueue({ job, ticket });
	return ticket;
    }

    // --- locking (tickets are the unique runner)

    lockTicket(ticketId, lock) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	rec.ticket.lock = lock || { type: "ticket", token: `ltk_${Date.now()}` };
	return 1;
    }

    lock(jobLike, key = "default", lock) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.lockTicket(ticketId, lock || { type: "jobKey", token: `ljk_${Date.now()}` });
    }

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

    unlock(jobLike, key = "default", token) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.unlockTicket(ticketId, token);
    }

    // --- cancel

    cancel(jobLike, key = "default") {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.cancelTicket(ticketId);
    }

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

	    st.active.state = "error";
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
