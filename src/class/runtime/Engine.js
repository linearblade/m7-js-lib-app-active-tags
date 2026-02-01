import helpers from './helpers.js';
import EngineState from './EngineState.js';
import { Scheduler } from './Scheduler.js';
import { PipelineRunner } from './PipelineRunner.js';
import { Tick } from './Tick.js';

export class Engine {
  constructor({ lib, jobRegistry, runner, scheduler, hooks = {}, builtins } = {}) {
    if (!lib) throw new Error("Engine requires lib");
    this.lib = lib;

    this.jobRegistry = jobRegistry || null;

    // subsystems
    this.state = new EngineState({ lib });
    this.scheduler = scheduler || new Scheduler({ lib });
    this.runner = runner || new PipelineRunner({ lib, builtins });
    this._tick = new Tick({ lib, engine: this });

    // hooks (optional)
    this.hooks = {
      onEnqueue: hooks.onEnqueue || null,
      onDequeue: hooks.onDequeue || null,
      onStage: hooks.onStage || null,
      onTicketDone: hooks.onTicketDone || null,
      onError: hooks.onError || null,
    };
  }

  // --- public tick façade

  tick({ ctx = {} } = {}) {
    return this._tick.tick({ ctx });
  }

  // --- job resolution (management layer)

  _resolveJob(jobLike) {
    const jr = this.jobRegistry;
    if (!jr || typeof jr.resolve !== "function") {
      throw new Error("Engine requires jobRegistry.resolve(jobLike)");
    }
    return jr.resolve(jobLike);
  }

  _resolveTicketId(jobLike, key = "default") {
    const job = this._resolveJob(jobLike);
    if (!job || !job.id) return null;

    const pipelineKey = String(key || "default");
    return this.state.aliasGet(job.id, pipelineKey);
  }

  // --- management API (enqueue/cancel/lock/unlock)

  enqueue(jobLike, key = "default", { inputs, priority = 0, meta = {} } = {}) {
    const job = this._resolveJob(jobLike);
    if (!job || !job.id) throw new Error("Engine.enqueue requires a resolved job with id");

    const jobId = job.id;
    const pipelineKey = String(key || "default");
    const st = this.state.jobState(jobId);

    // Dedup on (jobId + pipelineKey) via alias
    const existingId = st.alias.get(pipelineKey);
    if (existingId) {
      const existing = this.state.getTicket(existingId);
      if (existing) return existing;
      st.alias.delete(pipelineKey); // stale alias
    }

    const ticket = helpers.makeRunTicket({ jobId, pipelineKey, inputs, priority, meta });

    this.state.indexTicket(jobId, ticket);
    this.state.aliasSet(jobId, pipelineKey, ticket.id);

    st.queue.push(ticket);

    if (!st.active && !this.state.isLockedJobId(jobId)) {
      this.scheduler.markRunnable(jobId);
    }

    if (this.hooks.onEnqueue) this.hooks.onEnqueue({ job, ticket });
    return ticket;
  }

  lockTicket(ticketId, lock) {
    const rec = this.state.getTicketRec(ticketId);
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
    const rec = this.state.getTicketRec(ticketId);
    if (!rec) return 0;

    const t = rec.ticket;
    if (!t.lock) return 1;

    if (token && t.lock.token && token !== t.lock.token) return 0;

    t.lock = null;

    const st = this.state.jobs.get(rec.jobId);
    if (st && (st.active || st.queue.length)) this.scheduler.markRunnable(rec.jobId);

    return 1;
  }

  unlock(jobLike, key = "default", token) {
    const ticketId = this._resolveTicketId(jobLike, key);
    if (!ticketId) return 0;
    return this.unlockTicket(ticketId, token);
  }

  cancel(jobLike, key = "default") {
    const ticketId = this._resolveTicketId(jobLike, key);
    if (!ticketId) return 0;
    return this.cancelTicket(ticketId);
  }

  cancelTicket(ticketId) {
    const rec = this.state.getTicketRec(ticketId);
    if (!rec) return 0;

    const { jobId, ticket } = rec;
    const st = this.state.jobs.get(jobId);

    // Always clear global ticket index
    this.state.deleteTicket(ticketId);

    if (!st) return 1;

    // Active
    if (st.active && st.active.id === ticketId) {
      if (st.active.pipelineKey) this.state.aliasDeleteIfPointsTo(jobId, st.active.pipelineKey, ticketId);
      st.active.state = "error";
      st.active = null;

      if (st.queue.length && !this.state.isLockedJobId(jobId)) this.scheduler.markRunnable(jobId);
      return 1;
    }

    // Queued
    const before = st.queue.length;
    st.queue = st.queue.filter(x => x.id !== ticketId);

    if (st.queue.length !== before) {
      if (ticket && ticket.pipelineKey) this.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
      return 1;
    }

    // Stale index: alias cleanup if possible
    if (ticket && ticket.pipelineKey) this.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
    return 1;
  }
}

export default Engine;
