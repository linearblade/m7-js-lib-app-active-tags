// -----------------------------------------------------------------------------
// EngineState (authoritative runtime state: jobs, tickets, alias, lock helpers)
// -----------------------------------------------------------------------------
export class EngineState {
  constructor({ lib } = {}) {
    this.lib = lib || null;

    // jobId -> { queue[], active, stats, alias: Map<pipelineKey,ticketId> }
    this.jobs = new Map();

    // ticketId -> { jobId, ticket }
    this.tickets = new Map();
  }

  // --- core job state record

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
    const rec = this.tickets.get(ticketId);
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
   * Checks whether a job is blocked from running, based solely on ACTIVE ticket lock.
   * Tickets are the unique runners.
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
