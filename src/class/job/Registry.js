/**
 * Job Registry
 *
 * Central registry and identity manager for Jobs.
 *
 * Responsibilities:
 * - Owns job identity (id, createdAt) and guarantees uniqueness within a runtime.
 * - Maintains canonical indexes for resolving jobs by:
 *   - id
 *   - DOM element
 *   - logical name (non-unique, convenience only)
 * - Acts as the single source of truth for "which jobs exist right now".
 *
 * Explicit non-responsibilities:
 * - Does NOT execute jobs.
 * - Does NOT run pipelines, stacks, or intervals.
 * - Does NOT mutate job configuration.
 * - Does NOT interpret schemas or DOM config.
 *
 * Conceptual model:
 * - Scheduler is a *directory*, not a runner.
 * - Jobs may exist before or after registration.
 * - Registration binds identity and enables resolution.
 * - Resolution is tolerant and ergonomic (id | name | element | job-like).
 *
 * Identity rules:
 * - `id` is the true identity (stable, unique, scheduler-owned).
 * - `name` is a convenience alias (optional, non-unique).
 * - DOM element (`job.e`) is the physical anchor for registration.
 *
 * Indexes:
 * - byId   : Map<id, Job>
 * - byEl   : WeakMap<Element, id>
 * - byName : Map<name, Set<id>>
 *
 * Lifecycle integration:
 * - Scheduler is responsible for invoking `job.shutdown()` during unregister.
 * - Shutdown metadata is recorded for diagnostics (bounded FIFO log).
 *
 * Design notes:
 * - Resolution prefers correctness over convenience:
 *     id → element → name → job-like object
 * - Name collisions are allowed but surfaced via warnings.
 * - WeakMap is used for DOM binding to avoid memory leaks.
 *
 * This class is intentionally small and strict.
 * Execution, orchestration, and timing belong to runtime/Runner.
 */

import { SCHED_STATUS } from '../../constants.js';


export default class Registry {
    /**
     * Create a new Scheduler instance.
     *
     * The Scheduler is a registry and identity authority for Jobs.
     * It assigns unique identifiers, maintains resolution indexes,
     * and tracks lifecycle metadata, but does not execute jobs.
     *
     * @param {Object} [opts]
     * @param {string} [opts.prefix="at"]
     *     Prefix used when generating job ids.
     *     The final id format is implementation-defined but guaranteed
     *     unique within this Scheduler instance.
     *
     * @param {number} [opts.shutdownLogMax=200]
     *     Maximum number of shutdown records to retain in `shutdownLog`.
     *     Older entries are discarded in FIFO order.
     *
     * Internal state initialized:
     * - `byId`        : Map<string, Job>
     *     Primary identity index.
     *
     * - `byEl`        : WeakMap<Element, string>
     *     DOM element → job id binding.
     *     WeakMap is used to avoid leaking detached DOM nodes.
     *
     * - `byName`      : Map<string, Set<string>>
     *     Optional secondary index for logical job names.
     *     Names are not guaranteed unique.
     *
     * - `createdAt`   : Map<string, number>
     *     Job creation timestamps indexed by id.
     *     Redundant with `job.createdAt`, but retained for fast lookup
     *     and decoupled lifecycle tracking.
     *
     * - `shutdownLog` : Array<Object>
     *     Bounded log of job shutdown events for diagnostics.
     *
     * Notes:
     * - All identity and index state is local to this Scheduler instance.
     * - Multiple Schedulers may coexist without coordination.
     */
    constructor(opts = {}) {
	if(!lib) throw new Error("registry requires lib");
	this.lib = opts.lib;
	this.conf = this.lib.hash.to(opts.conf);

    
	this.env =  opts.env;
	this.prefix = this.conf.registry.prefix || "DEFAULT__at";
	this.counter = 0;

	// Primary indexes
	this.byId = new Map();      // id -> job
	this.byEl = new WeakMap();  // element -> id

	// Optional secondary indexes
	this.byName = new Map();    // name -> Set(ids)

	// Metadata
	this.createdAt = new Map(); // id -> timestamp (redundant if job carries it)

	this.shutdownLog = [];          // array of entries (bounded)
	this.shutdownLogMax = opts.shutdownLogMax || 200;
    }

    /**
     * Resolve a job reference into a Job instance.
     *
     * Thin public wrapper around the internal `_resolve` method.
     * Accepts ids, DOM elements, or job-like objects depending on resolver rules.
     *
     * @param {*} x
     *     Job reference (id, element, Job instance, or job-like object).
     *
     * @returns {Job|null}
     *     Resolved Job instance, or null if not found.
     */
    resolve(x) {
	return this._resolve(x);
    }
    /**
     * Generate the next unique job id.
     *
     * Ids are unique within this Scheduler instance and are generated
     * sequentially using the configured prefix.
     *
     * @returns {string}
     *     Newly generated job id.
     */ 
    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }
    /**
     * Check whether a DOM element is already registered.
     *
     * @param {Element} el
     *     DOM element to test.
     *
     * @returns {boolean}
     *     True if the element is already bound to a job.
     */
    hasElement(el) {
	return this.byEl.has(el);
    }
    /**
     * Get the job id associated with a DOM element.
     *
     * @param {Element} el
     *     DOM element bound to a job.
     *
     * @returns {string|null}
     *     Job id if found, otherwise null.
     */
    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }
    /**
     * Get a Job by its id.
     *
     * @param {string} id
     *     Job identifier.
     *
     * @returns {Job|null}
     *     Job instance if found, otherwise null.
     */
    getById(id) {
	return this.byId.get(id) || null;
    }

    /**
     * Get a Job bound to a specific DOM element.
     *
     * @param {Element} el
     *     DOM element bound to a job.
     *
     * @returns {Job|null}
     *     Job instance if found, otherwise null.
     */
    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    /**
     * Get a Job by its logical name.
     *
     * Behavior:
     * - If exactly one job is registered under the given name, it is returned.
     * - If multiple jobs share the same name:
     *   - A warning is emitted.
     *   - `null` is returned to avoid ambiguous resolution.
     * - If no jobs match, returns null.
     *
     * Notes:
     * - Job names are NOT required to be unique.
     * - This method is a convenience lookup, not a guaranteed resolver.
     * - Callers that expect multiple jobs should use `listByName(name)` instead.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @returns {Job|null}
     *     The resolved Job if unique, otherwise null.
     */
    getByName(name) {
	const list = this.listByName(name);

	if (list.length === 1) return list[0];
	if (list.length > 1) {
            this._warn?.(
		"W101_AMBIGUOUS_NAME",
		name,
		`multiple jobs found for name "${name}"`
            );
	}
	return null;
    }

    /**
     * List all registered jobs.
     *
     * @returns {Job[]}
     *     Array of all jobs currently registered with the Scheduler.
     */
    list() {
	return Array.from(this.byId.values());
    }
    /**
     * List all jobs matching a given status.
     *
     * Notes:
     * - Status comparison is strict equality (`===`).
     * - No validation is performed on the status value.
     *
     * @param {string} status
     *     Job status to match (e.g. JOB_STATUS.READY, RUNNING, ERROR).
     *
     * @returns {Job[]}
     *     Array of jobs whose `job.status` matches the provided status.
     */
    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    /**
     * List all jobs registered under a given logical name.
     *
     * Notes:
     * - Job names are NOT required to be unique.
     * - This method always returns an array.
     * - If no jobs match, an empty array is returned.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @returns {Job[]}
     *     Array of jobs matching the given name.
     */
    
    listByName(name) {
	if (!name) return [];

	const ids = this.byName.get(name);
	if (!ids || !ids.size) return [];

	const out = [];
	for (const id of ids) {
            const job = this.byId.get(id);
            if (job) out.push(job);
	}
	return out;
    }


    /**
     * Register a Job with the Scheduler.
     *
     * Responsibilities:
     * - Assigns a stable job identity (`id`, `createdAt`) if not already present.
     * - Indexes the job by:
     *   - id        → job
     *   - element   → id
     *   - name      → id (optional, non-unique)
     * - Ensures a single Job instance is associated with a given DOM element.
     *
     * Registration semantics:
     * - Idempotent by element:
     *   If a job is already registered for `job.e`, the existing job is returned.
     *
     * - Identity ownership:
     *   The Scheduler is the authority for job identity.
     *   If a job arrives with a pre-seeded `id`, it is respected *only if unused*.
     *
     * - Collision policy (v1.0):
     *   - HARD FAIL on id collision.
     *   - If `job.id` is already registered to a different job, an Error is thrown.
     *   - This prevents silent overwrites and ambiguous identity graphs.
     *
     * Name indexing:
     * - `job.name` is optional and NOT guaranteed unique.
     * - Names are indexed into a secondary map (`name → Set<id>`).
     * - Ambiguity is tolerated; resolution is handled at lookup time.
     *
     * Side effects:
     * - Mutates `job` via `job.setIdentity({ id, createdAt })`.
     * - Mutates internal scheduler indexes.
     *
     * @param {Job} job
     *     Job instance to register.
     *     Must have a bound DOM element (`job.e`).
     *
     * @returns {Job}
     *     The registered Job instance (either the existing one or the newly registered one).
     *
     * @throws {Error}
     *     If `job` or `job.e` is missing.
     *     If an id collision is detected with an existing job.
     */
    register(job) {
	if (!job || !job.e) throw new Error("[Scheduler] register(job) requires job.e");

	// Already registered element => return existing job
	const existing = this.getByElement(job.e);
	if (existing) return existing;

	// Respect pre-seeded identity if present; otherwise assign
	let id = job.id || this.nextId();

	// ---- guard against overwrites (id collisions) ----
	// If the id is already in use by a different job, do NOT overwrite.
	// Policy: allocate a fresh id if caller provided a colliding id.
	// (If you prefer hard-fail instead, replace the while-loop with a throw.)
	const taken = this.byId.get(id);
	/*
	//soft - leave in the event I change my midn
	if (taken && taken !== job) {
        // If caller seeded an id and it's taken, roll forward until free
        do { id = this.nextId(); }
        while (this.byId.has(id));
	}
	*/
	//hard
	if (taken && taken !== job) {
	    throw new Error(`[Scheduler] register(): id collision "${id}"`);
	}

	
	const createdAt = (job.createdAt != null) ? job.createdAt : Date.now();

	job.setIdentity({ id, createdAt });

	this.byId.set(job.id, job);
	this.byEl.set(job.e, job.id);

	// Metadata index (redundant if job carries it, but you use it in unregister)
	this.createdAt.set(job.id, createdAt);

	// Optional name index (probably wont be set yet. use setName later)
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }

    /**
     * Unregister a Job from the Scheduler.
     *
     * Responsibilities:
     * - Resolves the target job from an id, DOM element, or Job instance.
     * - Initiates a graceful shutdown of the job.
     * - Removes all scheduler indexes and metadata associated with the job.
     *
     * Resolution semantics:
     * - `jobOrIdOrEl` may be:
     *   - a Job instance
     *   - a job id (string)
     *   - a DOM element bound to a job
     * - If the target cannot be resolved, this method is a no-op and returns false.
     *
     * Shutdown semantics:
     * - `job.shutdown()` is invoked BEFORE index removal.
     *   This allows the job to:
     *   - cancel intervals
     *   - abort in-flight work
     *   - perform cleanup while scheduler context is still available
     *
     * Metadata handling:
     * - Shutdown metadata is recorded via `_recordShutdown`.
     * - The shutdown log is bounded to prevent unbounded memory growth.
     *
     * Side effects:
     * - Mutates scheduler indexes:
     *   - removes job from `byId`, `byEl`, `byName`, and `createdAt`
     * - Mutates job state via `job.shutdown()`
     *
     * Idempotency:
     * - Safe to call multiple times.
     * - Calling `unregister` on an already-unregistered job returns false.
     *
     * @param {Job|string|Element} jobOrIdOrEl
     *     Job reference, job id, or DOM element bound to the job.
     *
     * @param {Object} [opts]
     * @param {string} [opts.reason]
     *     Optional human-readable reason for shutdown (used for logging/diagnostics).
     *
     * @returns {boolean}
     *     `true` if a job was resolved and unregistered.
     *     `false` if no matching job was found.
     */
    unregister(jobOrIdOrEl, opts = {}) {
	const job = this._resolve(jobOrIdOrEl);
	if (!job) return false;

	// shutdown first (so job can still access scheduler-related context if needed)
	job.shutdown({ reason: opts.reason || "scheduler.unregister" });

	// record shutdown metadata (bounded)
	this._recordShutdown(job, { reason: opts.reason || "scheduler.unregister" });

	// remove from indexes
	this.byId.delete(job.id);
	this.createdAt.delete(job.id);
	this.byEl.delete(job.e);
	if (job.name) this._unindexName(job.name, job.id);

	return true;
    }

    /**
     * Assign or update the logical name of a Job and maintain name indexes.
     *
     * Purpose:
     * - Provides the Scheduler-controlled pathway for setting a job’s name.
     * - Ensures secondary indexes (`byName`) stay consistent when names change.
     *
     * Semantics:
     * - Job names are **convenience identifiers**, not unique identifiers.
     * - Multiple jobs may share the same name.
     * - Internally, names map to a `Set` of job ids.
     *
     * Behavior:
     * - If the job already has a name, it is first removed from the old name index.
     * - The new name is assigned via `job.setName(name)`.
     * - The job id is then indexed under the new name.
     *
     * Safety:
     * - If `job` is missing or does not yet have an id, this method is a no-op.
     *   (Jobs must be registered before they can be indexed by name.)
     *
     * @param {Job} job
     *     Job instance whose name should be updated.
     *
     * @param {string|null} name
     *     Logical name to assign to the job.
     *     Passing a falsy value effectively clears the job’s name.
     *
     * @returns {void}
     */
    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.setName(name);
	this._indexName(name, job.id);
    }


    // ---- INTERNAL METHODS ----

    /**
     * Add a job id to the name index.
     *
     * Internal helper used to maintain the `byName` secondary index.
     *
     * Semantics:
     * - Multiple job ids may be associated with the same name.
     * - Names map to `Set<id>` to support efficient add/remove.
     *
     * Safety:
     * - Falsy names are ignored.
     * - Idempotent for the same (name, id) pair.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @param {string|number} id
     *     Job id to associate with the name.
     *
     * @returns {void}
     */
    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    /**
     * Remove a job id from the name index.
     *
     * Internal helper used to keep `byName` consistent when:
     * - a job is renamed
     * - a job is unregistered
     *
     * Behavior:
     * - If the resulting id set becomes empty, the name entry is removed entirely.
     *
     * Safety:
     * - No-op if the name is not indexed.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @param {string|number} id
     *     Job id to remove from the name mapping.
     *
     * @returns {void}
     */
    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }


    /**
     * Resolve a job reference into a Job instance.
     *
     * This is the Scheduler’s internal resolution primitive and is used by
     * public-facing methods such as `resolve`, `unregister`, etc.
     *
     * Resolution order & semantics:
     * - `null` / falsy → `null`
     *
     * - string:
     *   1) Treated as a job id first.
     *   2) If no id match is found, treated as a job name.
     *      - If multiple jobs share the name, `getByName` will warn and return null.
     *
     * - DOM element:
     *   - Resolves via element-to-job binding.
     *
     * - job-like object:
     *   - If the object has both `id` and `e`, it is assumed to already be a Job
     *     (or a compatible job-like structure) and is returned as-is.
     *
     * - object with `e` property:
     *   - Treated as a wrapper and resolved via its bound element.
     *
     * Failure behavior:
     * - If the reference cannot be resolved, returns `null`.
     * - This method never throws.
     *
     * @param {*} x
     *     Job reference. May be:
     *     - job id (string)
     *     - job name (string)
     *     - DOM element
     *     - Job instance
     *     - object containing `{ e: Element }`
     *
     * @returns {Job|null}
     *     Resolved Job instance, or `null` if no match is found.
     */
    
    _resolve(x) {
	if (!x) return null;

	// string: id first, then name
	if (typeof x === "string") {
            const byId = this.getById(x);
            if (byId) return byId;

            // fallback to name
            return this.getByName(x);
	}

	// element
	if (x.nodeType === 1) return this.getByElement(x);

	// job-like (already a job)
	if (x.id && x.e) return x;

	// object containing element
	if (x.e) return this.getByElement(x.e);

	return null;
    }


    /**
     * Record a shutdown event for a job.
     *
     * Purpose:
     * - Maintain a bounded, in-memory audit log of job shutdowns.
     * - Useful for debugging lifecycle issues, scheduler behavior,
     *   and post-mortem inspection during development.
     *
     * Behavior:
     * - Captures a lightweight snapshot of the job identity and context
     *   at the moment of shutdown.
     * - Appends the entry to `this.shutdownLog`.
     * - Enforces a FIFO bound using `this.shutdownLogMax`.
     *
     * Captured fields:
     * - at      : timestamp (ms since epoch)
     * - id      : job id (if available)
     * - name    : job name (if available)
     * - reason  : shutdown reason (if provided)
     * - tag     : DOM tag name (lowercased) of the bound element
     * - elId    : DOM element id (if present)
     *
     * Notes:
     * - This function never throws.
     * - Logging is best-effort and intentionally shallow.
     * - This is NOT intended to be a durable audit trail.
     *
     * @param {Job} job
     *     Job instance being shut down.
     *
     * @param {Object} [info]
     * @param {string} [info.reason]
     *     Optional human-readable shutdown reason.
     *
     * @returns {void}
     */
    _recordShutdown(job, info = {}) {
	const entry = {
            at: Date.now(),
            id: job.id || null,
            name: job.name || null,
            reason: info.reason || null,
            tag: job.e && job.e.tagName ? String(job.e.tagName).toLowerCase() : null,
            elId: job.e && job.e.id ? String(job.e.id) : null,
	};

	this.shutdownLog.push(entry);

	// Bound the log (FIFO)
	const max = this.shutdownLogMax;
	if (max > 0 && this.shutdownLog.length > max) {
            this.shutdownLog.splice(0, this.shutdownLog.length - max);
	}
    }
}
