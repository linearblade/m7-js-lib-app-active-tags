// Job.js
// ActiveTags Job: persistent binding to a DOM element + per-run context.
//
// Philosophy:
// - Job identity is stable (id, element, createdAt) and should be assigned by Scheduler.
// - Job config is usually snapshotted at register-time (ds).
// - A small set of fields can be refreshed from DOM per run (attr.action/method, etc).
// - Execution-specific state lives in job.run (ephemeral), not on the root job.

export const JOB_STATUS = Object.freeze({
  READY: "ready",
  RUNNING: "running",
  WAIT: "wait",
  ERROR: "error",
  COMPLETE: "complete",
  DETACHED: "detached",
});

export const JOB_TYPE = Object.freeze({
  LOAD: "load",
  SUBMIT: "submit",
  MANUAL: "manual",
});

export default class Job {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.e - DOM element backing this job
   * @param {string} [opts.id] - unique id assigned by Scheduler
   * @param {number} [opts.createdAt] - timestamp assigned by Scheduler
   * @param {object} [opts.ds] - dataset/config snapshot (object)
   * @param {object} [opts.attr] - attribute snapshot (action/method etc)
   * @param {string} [opts.type] - JOB_TYPE.*
   * @param {string} [opts.name] - logical name; may collide; not guaranteed unique
   * @param {string} [opts.status] - JOB_STATUS.*
   * @param {object} [opts.ws] - workspace root for this job (persistent)
   * @param {object} [opts.intervals] - per-job interval handles/locks (optional)
   */
  constructor(opts = {}) {
    if (!opts.e) throw new Error("[Job] missing required element (opts.e)");

    this.e = opts.e;

    // identity (stable) — assigned by Scheduler (or null until registered)
    this.id = opts.id ?? null;
    this.createdAt = opts.createdAt ?? Date.now();
    this.type = opts.type || JOB_TYPE.LOAD;

    // name (logical; not guaranteed unique)
    this.name = opts.name || null;

    // config snapshots
    this.ds = opts.ds || {};
    this.attr = opts.attr || {};

    // binding state (mutable)
    this.status = opts.status || JOB_STATUS.READY;
    this.load = 0; // legacy flag
    this.error = null;

    // execution primitives / caches
    this.stack = {};                 // existing engine expects this
    this.intervals = opts.intervals || {}; // optional per-job interval handles/locks
    this.ws = opts.ws || {};         // persistent per-job workspace root

    // per-run ephemeral state
    this.run = null;

    // internal flags
    this.flags = {
      attached: true,
      hasRun: false,
      stacksBuilt: false,
      dirty: false,
    };
  }

  /**
   * Scheduler/runtime assigns identity after creation.
   * Useful when Job is created before registration.
   */
  setIdentity({ id, createdAt } = {}) {
    if (id != null) this.id = id;
    if (createdAt != null) this.createdAt = createdAt;
    return this;
  }

  beginRun(meta = {}) {
    // require an id once we're actually executing (optional but helps catch wiring mistakes)
    // if (this.id == null) throw new Error("[Job] beginRun called before Scheduler assigned job.id");

    this.run = {
      id: `${this.id ?? "unregistered"}:run:${Date.now()}`,
      startedAt: Date.now(),
      meta,
      buffer: undefined,
      request: null,
      response: null,
    };
    this.status = JOB_STATUS.RUNNING;
    this.error = null;
    return this.run;
  }

  endRun(status = JOB_STATUS.COMPLETE) {
    if (this.run) this.run.endedAt = Date.now();
    this.flags.hasRun = true;
    this.status = status;
    return this;
  }

  refreshFromDom(opts = {}) {
    const { action = true, method = true } = opts;
    if (action) this.attr.action = this.e.getAttribute("action");
    if (method) this.attr.method = this.e.getAttribute("method");
    return this;
  }

  updateDataset(nextDs = {}) {
    this.ds = nextDs || {};
    this.flags.dirty = true;
    return this;
  }

  setName(name) {
    this.name = name;
    if (this.ds && typeof this.ds === "object") this.ds.name = name;
    return this;
  }

  detach() {
    this.flags.attached = false;
    this.status = JOB_STATUS.DETACHED;
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      createdAt: this.createdAt,
      flags: { ...this.flags },
      ds: this.ds,
      attr: this.attr,
      load: this.load,
      error: this.error ? String(this.error) : null,
    };
  }
}
