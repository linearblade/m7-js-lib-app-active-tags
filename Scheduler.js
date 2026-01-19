// Scheduler.js
// Owns job IDs + job registry. Does NOT run stacks.


export const SCHED_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});

export default class Scheduler {
    constructor(opts = {}) {
	this.prefix = opts.prefix || "at";
	this.counter = 0;

	// Primary indexes
	this.byId = new Map();      // id -> job
	this.byEl = new WeakMap();  // element -> id

	// Optional secondary indexes
	this.byName = new Map();    // name -> Set(ids)

	// Metadata
	this.createdAt = new Map(); // id -> timestamp (redundant if job carries it)
    }

    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }

    hasElement(el) {
	return this.byEl.has(el);
    }

    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }

    getById(id) {
	return this.byId.get(id) || null;
    }

    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    list() {
	return Array.from(this.byId.values());
    }

    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    register(job) {
	if (!job || !job.e) throw new Error("[Scheduler] register(job) requires job.e");

	// Already registered element => return existing job
	const existing = this.getByElement(job.e);
	if (existing) return existing;

	// Ensure job has an id issued by scheduler
	if (!job.id) job.id = this.nextId();

	this.byId.set(job.id, job);
	this.byEl.set(job.e, job.id);
	this.createdAt.set(job.id, job.createdAt || Date.now());

	// Optional name index
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }

    unregister(jobOrIdOrEl) {
	const job = this._resolve(jobOrIdOrEl);
	if (!job) return false;

	this.byId.delete(job.id);
	this.createdAt.delete(job.id);
	this.byEl.delete(job.e);

	if (job.name) this._unindexName(job.name, job.id);

	return true;
    }

    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.name = name;
	this._indexName(name, job.id);
    }

    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }

    _resolve(x) {
	if (!x) return null;
	if (typeof x === "string") return this.getById(x);
	if (x.nodeType === 1) return this.getByElement(x); // element
	if (x.id && x.e) return x; // job-like
	return null;
    }
}
