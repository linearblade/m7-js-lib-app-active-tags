/**
 * EngineState
 * -----------
 * Authoritative in-memory runtime state store for the Engine.
 *
 * Role
 * ----
 * EngineState owns the canonical data structures that represent:
 * - per-job execution queues and active ticket assignment
 * - ticket indexing (ticketId -> { jobId, ticket })
 * - alias mappings (jobId + pipelineKey -> ticketId)
 * - minimal lock inspection helpers
 *
 * EngineState is deliberately not a policy layer.
 * It does not schedule, execute, or interpret pipelines.
 * It provides stable primitives used by EngineManager, Tick, and Scheduler.
 *
 * Core invariants
 * ---------------
 * - `jobState(jobId)` is idempotent and will initialize missing job records.
 * - `tickets` is the global index of all known tickets.
 * - Each job record contains:
 *     - queue : Array<ticket>
 *     - active: ticket|null
 *     - alias : Map<pipelineKey, ticketId>
 *
 * Lock semantics
 * --------------
 * - `isLockedJobId(jobId)` considers only the ACTIVE ticket lock.
 * - Locks are treated as opaque objects, with optional expiration:
 *     lock.until (epoch ms)
 * - Expired locks are cleared as a side effect of inspection.
 *
 * This class should remain small and stable.
 * If new policy is needed (eg lock types, cross-job constraints),
 * implement it in EngineManager or Scheduler, not here.
 */

export class EngineState {
    constructor({ lib } = {}) {
	this.lib = lib || null;

	// jobId -> { queue[], active, stats, alias: Map<pipelineKey,ticketId> }
	this.jobs = new Map();

	// ticketId -> { jobId, ticket }
	this.tickets = new Map();
    }

    // --- core job state record

    /**
     * Get (or lazily create) the runtime state bucket for a job.
     *
     * Semantics:
     * - Ensures every referenced `jobId` has a stable state container.
     * - Creation is idempotent and occurs on first access.
     *
     * State shape:
     * - queue  : pending tickets (FIFO per job)
     * - active : currently running ticket (or null)
     * - stats  : lightweight execution metrics
     * - alias  : Map<pipelineKey, ticketId> for dedupe/lookup
     *
     * @param {string} jobId
     * @returns {Object} Job-scoped runtime state container.
     */
    jobState(jobId) {
	let st = this.jobs.get(jobId);
	if (!st) {
	    st = {
		queue: [],
		active: null,
		stats: { runs: 0, errors: 0, lastRunAt: 0 },
		alias: new Map(),
	    };
	    this.jobs.set(jobId, st);
	}
	return st;
    }

    // --- ticket index

    getTicketRec(ticketId) {
	return this.tickets.get(ticketId) || null;
    }

    getTicket(ticketId) {
	const lookup = (typeof ticketId === 'object' && ticketId.id) ? ticketId.id : ticketId;
	    
	const rec = this.tickets.get(lookup);
	return rec ? rec.ticket : null;
    }

    indexTicket(jobId, ticket) {
	this.tickets.set(ticket.id, { jobId, ticket });
	return ticket;
    }

    deleteTicket(ticketId) {
	this.tickets.delete(ticketId);
    }

    // --- alias helpers

    aliasGet(jobId, pipelineKey) {
	const st = this.jobs.get(jobId);
	if (!st) return null;
	return st.alias.get(pipelineKey) || null;
    }

    aliasSet(jobId, pipelineKey, ticketId) {
	const st = this.jobState(jobId);
	st.alias.set(pipelineKey, ticketId);
    }

    aliasDeleteIfPointsTo(jobId, pipelineKey, ticketId) {
	const st = this.jobs.get(jobId);
	if (!st) return;
	if (st.alias.get(pipelineKey) === ticketId) st.alias.delete(pipelineKey);
    }

    // --- lock helpers

    isExpired(lock) {
	return !!(lock && lock.until && Date.now() > lock.until);
    }

    /**
     * Determine whether a job is currently locked from execution.
     *
     * Lock semantics:
     * - Only the ACTIVE ticket can block execution.
     * - If there is no active ticket, the job is not locked.
     * - If the active ticket has no lock, the job is not locked.
     * - If the lock is expired, it is cleared and the job is considered unlocked.
     *
     * This method does not inspect queued tickets.
     *
     * @param {string} jobId
     * @returns {boolean}
     *   True if the job is actively locked and the lock is still valid.
     */
    isLockedJobId(jobId) {
	const st = this.jobs.get(jobId);
	if (!st || !st.active) return false;

	const t = st.active;
	if (!t.lock) return false;

	if (this.isExpired(t.lock)) {
	    t.lock = null;
	    return false;
	}

	return true;
    }
}

export default EngineState;
