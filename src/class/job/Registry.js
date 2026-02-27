/**
 * Job Registry
 * ============
 *
 * Central registry and identity manager for Job instances.
 *
 *
 * ROLE IN THE SYSTEM
 * ------------------
 * The Registry is the authoritative directory of all Jobs currently
 * known to the runtime. It owns identity assignment and provides
 * deterministic resolution across multiple lookup modes.
 *
 * It is a directory, not a runner.
 *
 *
 * RESPONSIBILITIES
 * ----------------
 * - Assign and guarantee unique job identity (id, createdAt).
 * - Maintain canonical indexes for resolving Jobs by:
 *     - id
 *     - DOM element
 *     - logical name (non-unique)
 * - Serve as the single source of truth for which Jobs exist.
 * - Coordinate controlled unregistration and lifecycle shutdown.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * - Does not execute Jobs.
 * - Does not enqueue or drain pipelines.
 * - Does not interpret schema or configuration.
 * - Does not mutate JobConfig.
 *
 *
 * IDENTITY MODEL
 * --------------
 * - id is the canonical unique identifier.
 * - name is an optional convenience alias and may collide.
 * - job.e (DOM element) is the physical anchor for registration.
 *
 *
 * INDEX STRUCTURE
 * ---------------
 * - byId   : Map<id, Job>
 * - byEl   : WeakMap<Element, id>
 * - byName : Map<name, Set<id>>
 *
 * WeakMap is used for DOM bindings to avoid memory leaks when
 * elements are garbage-collected.
 *
 *
 * RESOLUTION POLICY
 * -----------------
 * Resolution is ergonomic but deterministic:
 *   id → element → name → job-like object
 *
 * Name collisions are allowed but must be handled explicitly
 * by callers when multiple matches exist.
 *
 *
 * LIFECYCLE INTEGRATION
 * ---------------------
 * - unregister() invokes job.shutdown() before removal.
 * - Shutdown metadata may be recorded in a bounded diagnostic log.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * - Small and strict.
 * - No execution semantics.
 * - No hidden side effects.
 * - Identity and indexing must remain internally consistent.
 */


export default class Registry {
    /**
     * Create a new Job Registry instance.
     *
     * CONTRACT
     * --------
     * The Registry is a directory and identity authority for Jobs.
     * It assigns unique identifiers, maintains resolution indexes, and
     * coordinates controlled unregistration, but it does not execute jobs.
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *
     * @param {Object} opts.lib
     *   Required m7 lib instance.
     *
     * @param {Object} [opts.conf]
     *   Optional registry configuration object.
     *   When provided, prefix is read from conf.registry.prefix.
     *
     * @param {Object} [opts.env]
     *   Optional environment context (document, baseURI, hooks).
     *
     * @param {number} [opts.shutdownLogMax=200]
     *   Maximum number of shutdown records retained in shutdownLog.
     *   Older entries are discarded in FIFO order.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * Identity
     * - this.prefix    string prefix used when generating ids
     * - this.counter   monotonic counter used for id generation
     *
     * Indexes
     * - this.byId      Map<id, Job> primary identity index
     * - this.byEl      WeakMap<Element, id> element binding index
     * - this.byName    Map<name, Set<id>> optional secondary name index
     *
     * Metadata
     * - this.createdAt Map<id, number> creation timestamps (redundant with job.createdAt)
     * - this.shutdownLog Array diagnostic shutdown records (bounded FIFO)
     * - this.shutdownLogMax number max retained shutdown records
     *
     *
     * NOTES
     * -----
     * - All identity and index state is local to this Registry instance.
     * - Multiple registries may coexist without coordination.
     * - WeakMap is used for DOM bindings to avoid leaking detached DOM nodes.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if opts.lib is missing.
     */
    constructor(opts = {}) {
	if(!opts?.lib) throw new Error("registry requires lib");
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
     * CONTRACT
     * --------
     * resolve() converts a flexible job reference into a canonical Job
     * instance using registry resolution rules.
     *
     * This is a thin public wrapper around the internal _resolve() method.
     *
     *
     * ACCEPTED INPUT FORMS
     * --------------------
     * - id (string or number)
     * - DOM element bound to a Job
     * - Job instance
     * - job-like object (containing id and/or e)
     *
     *
     * RESOLUTION POLICY
     * -----------------
     * Resolution is tolerant but deterministic.
     * If no matching Job exists in the registry, null is returned.
     *
     *
     * INPUT
     * -----
     * @param {*} x
     *   Job reference of any supported type.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The resolved Job instance, or null if not found.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register jobs.
     * Does not mutate registry state.
     * Does not throw on resolution failure.
     */
    resolve(x) {
	return this._resolve(x);
    }
    /**
     * Generate the next unique Job id.
     *
     * CONTRACT
     * --------
     * nextId() produces a new identifier that is guaranteed to be unique
     * within this Registry instance.
     *
     * Ids are generated sequentially using the configured prefix and
     * an internal monotonic counter.
     *
     *
     * FORMAT
     * ------
     * `${prefix}-${counter}`
     *
     * The exact format is an implementation detail and should not be
     * parsed externally.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string}
     *   Newly generated unique Job identifier.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register the id.
     * Does not validate collisions externally.
     * Uniqueness is guaranteed only within this Registry instance.
     */
    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }
    /**
     * Determine whether a DOM element is already registered.
     *
     * CONTRACT
     * --------
     * hasElement() checks whether the provided DOM element is currently
     * bound to a Job within this Registry instance.
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element to test.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if the element is already associated with a registered Job.
     *   false otherwise.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve the Job.
     * Does not validate element type.
     * Does not mutate registry state.
     */
    hasElement(el) {
	return this.byEl.has(el);
    }
    /**
     * Retrieve the Job id associated with a DOM element.
     *
     * CONTRACT
     * --------
     * getIdByElement() returns the registered Job id bound to the
     * provided DOM element, if one exists.
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element previously registered with a Job.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string|null}
     *   The associated Job id if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve or return the Job instance.
     * Does not validate the element type.
     * Does not mutate registry state.
     */
    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }

    /**
     * Retrieve a Job by its id.
     *
     * CONTRACT
     * --------
     * getById() returns the registered Job associated with the provided
     * identifier, if one exists in this Registry instance.
     *
     *
     * INPUT
     * -----
     * @param {string} id
     *   Canonical Job identifier.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The corresponding Job instance if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not attempt resolution from other reference types.
     * Does not throw if the id is unknown.
     * Does not mutate registry state.
     */
    getById(id) {
	return this.byId.get(id) || null;
    }

    /**
     * Retrieve the Job bound to a specific DOM element.
     *
     * CONTRACT
     * --------
     * getByElement() resolves the Job associated with the provided
     * DOM element, if one exists in this Registry instance.
     *
     * Resolution is performed by:
     *   1) Looking up the Job id via getIdByElement()
     *   2) Retrieving the Job via getById()
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element previously registered with a Job.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The associated Job instance if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register elements.
     * Does not validate element type.
     * Does not mutate registry state.
     */
    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    /**
     * Retrieve a Job by its logical name.
     *
     * CONTRACT
     * --------
     * getByName() attempts to resolve a Job using its convenience name.
     * Because names are not required to be unique, resolution is strict:
     *
     *   - If exactly one Job matches, it is returned.
     *   - If multiple Jobs share the name, a warning may be emitted and
     *     null is returned to avoid ambiguity.
     *   - If no Jobs match, null is returned.
     *
     *
     * SEMANTICS
     * ---------
     * - This is a convenience lookup only.
     * - Name uniqueness is not enforced by the Registry.
     * - Callers expecting multiple results should use listByName(name).
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The uniquely resolved Job instance, or null if none or ambiguous.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce name uniqueness.
     * Does not mutate registry state.
     * Does not throw on ambiguity.
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
     * List all registered Jobs.
     *
     * CONTRACT
     * --------
     * list() returns a snapshot array of all Job instances currently
     * registered within this Registry.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of registered Job instances.
     *
     *
     * NOTES
     * -----
     * - The returned array is a shallow snapshot.
     * - Mutating the array does not affect registry state.
     * - Order is implementation-defined (insertion order of Map).
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not filter by status.
     * Does not sort.
     * Does not mutate registry state.
     */
    list() {
	return Array.from(this.byId.values());
    }

    /**
     * List all registered Job identifiers.
     *
     * CONTRACT
     * --------
     * listIds() returns a snapshot array of ids for all Jobs currently
     * registered within this Registry.
     *
     * @returns {Array<string|number>}
     *   Array of Job ids.
     */
    listIds() {
	return Array.from(this.byId.values()).map((job) => job && job.id);
    }

    /**
     * List all registered Job names.
     *
     * CONTRACT
     * --------
     * listNames() returns a snapshot array of names for all Jobs currently
     * registered within this Registry.
     *
     * @returns {Array<string|null|undefined>}
     *   Array of Job names as currently assigned.
     */
    listNames() {
	return Array.from(this.byId.values()).map((job) => job && job.name);
    }

    /**
     * List all Jobs matching a given lifecycle status.
     *
     * CONTRACT
     * --------
     * listByStatus() returns a snapshot array of Jobs whose
     * job.status strictly equals the provided value.
     *
     *
     * SEMANTICS
     * ---------
     * - Comparison uses strict equality (===).
     * - No validation is performed on the status argument.
     * - If no Jobs match, an empty array is returned.
     *
     *
     * INPUT
     * -----
     * @param {string} status
     *   Lifecycle status to match (e.g. JOB_STATUS.READY, RUNNING, ERROR).
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of Jobs with a matching status.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not sort results.
     * Does not mutate registry state.
     * Does not validate status enum correctness.
     */
    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    /**
     * List all Jobs registered under a given logical name.
     *
     * CONTRACT
     * --------
     * listByName() returns all Job instances currently indexed under
     * the provided convenience name.
     *
     *
     * SEMANTICS
     * ---------
     * - Job names are not required to be unique.
     * - Always returns an array.
     * - If no Jobs match, an empty array is returned.
     * - Resolution is based on the current byName index.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of matching Job instances.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not validate name format.
     * Does not mutate registry state.
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
     * Register a Job with this Registry.
     *
     * CONTRACT
     * --------
     * register() binds a Job into the Registry and establishes canonical
     * identity and resolution indexes.
     *
     * When element indexing is enabled, registration is idempotent by DOM element:
     *   - If a Job is already registered for job.e, the existing Job is returned.
     *
     *
     * RESPONSIBILITIES
     * ----------------
     * - Ensure a single Job instance is associated with a given DOM element
     *   when element indexing is enabled.
     * - Assign stable identity (id, createdAt) when missing.
     * - Maintain indexes:
     *     - byId:   id -> Job
     *     - byEl:   element -> id
     *     - byName: name -> Set<id> (optional, non-unique)
     * - Record createdAt metadata in the Registry (redundant with job.createdAt).
     *
     *
     * IDENTITY OWNERSHIP
     * ------------------
     * The Registry is the authority for identity uniqueness.
     * A pre-seeded job.id is respected only if it is not already in use.
     *
     *
     * COLLISION POLICY
     * ----------------
     * v1 policy is hard fail:
     *   - If the resolved id is already registered to a different Job,
     *     an Error is thrown to prevent silent overwrites.
     *
     *
     * NAME INDEXING
     * -------------
     * - job.name is optional and not guaranteed unique.
     * - Names are indexed into byName as: name -> Set<id>.
     * - Ambiguity is tolerated; strict resolution is handled at lookup time.
     *
     *
     * SIDE EFFECTS
     * ------------
     * - Mutates the Job via job.setIdentity({ id, createdAt }).
     * - Mutates internal registry indexes and metadata maps.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Job instance to register.
     *
     * @param {Object} [opts={}]
     *   Registration options.
     *
     * @param {boolean} [opts.indexElement=true]
     *   Whether to index/resolve by `job.e`.
     *   When true, `job.e` is required.
     *
     * @param {boolean} [opts.returnExisting=false]
     *   When true, returns matching existing records by id/name before
     *   creating a new identity binding.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   The registered Job instance (existing or newly registered).
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if:
     * - job is missing
     * - opts.indexElement is true and job.e is missing
     * - an id collision is detected with an existing registered Job
     */
    register(job, opts = {}) {
	opts = this.lib.hash.to(opts, "indexElement returnExisting");
	const indexElement = !this.lib.bool.no(opts.indexElement);
	const returnExisting = this.lib.bool.yes(opts.returnExisting);
	if (!job || (indexElement && !job.e)) {
	    throw new Error("[Scheduler] register(job) requires job.e");
	}

	// Optional reuse path (id/name) for synthetic/internal registrations.
	if (returnExisting) {
	    if (job.id) {
		const byId = this.getById(job.id);
		if (byId) return byId;
	    }

	    if (job.name) {
		const byName = this.listByName(job.name);
		if (this.lib.array.len(byName)) return byName[0];
	    }
	}

	// Already registered element => return existing job
	if (indexElement) {
	    const existing = this.getByElement(job.e);
	    if (existing) return existing;
	}

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
	    if (returnExisting) return taken;
	    throw new Error(`[Scheduler] register(): id collision "${id}"`);
	}

	
	const createdAt = (job.createdAt != null) ? job.createdAt : Date.now();

	job.setIdentity({ id, createdAt });

	this.byId.set(job.id, job);
	if (indexElement && job.e) this.byEl.set(job.e, job.id);

	// Metadata index (redundant if job carries it, but you use it in unregister)
	this.createdAt.set(job.id, createdAt);

	// Optional name index (probably wont be set yet. use setName later)
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }

    /**
     * Unregister a Job from this Registry.
     *
     * CONTRACT
     * --------
     * unregister() removes a Job from all registry indexes and records a
     * bounded shutdown entry. It attempts a graceful teardown by invoking
     * job.shutdown() before removal.
     *
     * If the target cannot be resolved, this method is a no-op and returns false.
     *
     *
     * RESOLUTION
     * ----------
     * The target may be provided as:
     * - Job instance
     * - job id (string/number)
     * - DOM element bound to a Job
     * - job-like object (id/e)
     *
     * Resolution is performed via the internal _resolve() policy.
     *
     *
     * SHUTDOWN ORDER
     * --------------
     * job.shutdown() is invoked before index removal so the Job may perform
     * teardown while it still has access to its environment context.
     *
     *
     * METADATA
     * --------
     * - A shutdown record is written via _recordShutdown().
     * - The shutdown log is bounded (FIFO) to prevent memory growth.
     *
     *
     * SIDE EFFECTS
     * ------------
     * - Invokes job.shutdown({ reason }).
     * - Removes the Job from:
     *     - byId
     *     - byEl
     *     - byName (if indexed)
     *     - createdAt
     * - Appends a bounded diagnostic record to shutdownLog.
     *
     *
     * IDEMPOTENCY
     * -----------
     * - Safe to call repeatedly.
     * - Returns false if the Job is not currently registered.
     *
     *
     * INPUT
     * -----
     * @param {Job|string|number|Element|Object} jobOrIdOrEl
     *   Job reference, job id, DOM element, or job-like object.
     *
     * @param {Object} [opts={}]
     *
     * @param {string} [opts.reason]
     *   Optional human-readable reason used for shutdown and diagnostics.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if a Job was resolved and unregistered.
     *   false if no matching Job was found.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not cancel Engine queues directly.
     * Does not destroy the Job instance.
     * Does not prevent the caller from re-registering later.
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
     * CONTRACT
     * --------
     * setName() is the registry-managed pathway for updating a Job's
     * convenience name while keeping the byName index consistent.
     *
     *
     * SEMANTICS
     * ---------
     * - Names are convenience identifiers and are not unique.
     * - Multiple Jobs may share the same name.
     * - Internally, byName maps: name -> Set<id>.
     *
     *
     * BEHAVIOR
     * --------
     * - If the Job currently has a name, the Job id is removed from the old
     *   byName bucket.
     * - The new name is assigned via job.setName(name).
     * - The Job id is indexed under the new name (if name is truthy).
     *
     *
     * SAFETY
     * ------
     * - If job is missing or job.id is missing, this is a no-op.
     *   Jobs must be registered before they can be indexed by name.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Registered Job instance to update.
     *
     * @param {string|null} name
     *   New logical name to assign. Falsy clears the name and removes indexing.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not register the Job.
     * Does not mutate other indexes beyond name indexing.
     */
    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.setName(name);
	this._indexName(name, job.id);
    }


    // ---- INTERNAL METHODS ----

    /**
     * Add a Job id to the secondary name index.
     *
     * CONTRACT
     * --------
     * _indexName() associates a Job id with a logical name inside
     * the byName index.
     *
     *
     * SEMANTICS
     * ---------
     * - Multiple ids may be associated with the same name.
     * - Names map to Set<id> for efficient add and delete operations.
     * - Operation is idempotent for an existing (name, id) pair.
     *
     *
     * SAFETY
     * ------
     * - Falsy names are ignored.
     * - Does not validate id existence in byId.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     * @param {string|number} id
     *   Job id to associate with the name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not register the Job.
     * Does not emit warnings on collisions.
     */
    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    /**
     * Remove a Job id from the secondary name index.
     *
     * CONTRACT
     * --------
     * _unindexName() removes the association between a logical name
     * and a Job id within the byName index.
     *
     *
     * SEMANTICS
     * ---------
     * - If the id exists in the name's Set, it is removed.
     * - If the resulting Set becomes empty, the name entry is deleted
     *   entirely from byName.
     *
     *
     * SAFETY
     * ------
     * - No-op if the name is not indexed.
     * - No-op if the id is not present in the Set.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     * @param {string|number} id
     *   Job id to remove from the name mapping.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate id existence in byId.
     * Does not throw on missing mappings.
     */
    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }


    /**
     * Internal resolution primitive for converting a reference into a Job.
     *
     * CONTRACT
     * --------
     * _resolve() attempts to normalize a flexible job reference into a
     * canonical Job instance using registry indexes.
     *
     * This method never throws and returns null on failure.
     *
     *
     * RESOLUTION ORDER
     * ----------------
     * 1) Falsy input
     *    - null or undefined → null
     *
     * 2) String
     *    - Attempt id lookup via getById()
     *    - Fallback to name lookup via getByName()
     *
     * 3) DOM Element
     *    - Resolve via element binding (getByElement)
     *
     * 4) Object with id property
     *    - Attempt id lookup via getById()
     *
     * 5) Object with e property
     *    - Resolve via element binding
     *
     * 6) Otherwise
     *    - null
     *
     *
     * FAILURE POLICY
     * --------------
     * - Returns null if resolution fails.
     * - Does not emit warnings except those triggered by getByName().
     *
     *
     * INPUT
     * -----
     * @param {*} x
     *   Flexible Job reference:
     *     - id (string)
     *     - name (string)
     *     - DOM element
     *     - Job instance
     *     - object containing { id?: string, e?: Element }
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   Resolved Job instance, or null if no match.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register Jobs.
     * Does not validate schema state.
     * Does not mutate registry state.
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

	// object with id: resolve through primary id index
	if (x && typeof x === "object" && x.id) {
	    const byId = this.getById(x.id);
	    if (byId) return byId;
	}

	// object containing element
	if (x.e) return this.getByElement(x.e);

	return null;
    }


    /**
     * Record a shutdown event for a Job.
     *
     * CONTRACT
     * --------
     * _recordShutdown() appends a lightweight, bounded diagnostic entry
     * describing a Job shutdown event.
     *
     * This log is intended for debugging and lifecycle inspection only.
     * It is not a durable audit trail.
     *
     *
     * SEMANTICS
     * ---------
     * - Captures a shallow snapshot of identity and DOM context.
     * - Appends the entry to this.shutdownLog.
     * - Enforces a FIFO bound using this.shutdownLogMax.
     *
     *
     * CAPTURED FIELDS
     * ---------------
     * - at     : number   timestamp (epoch ms)
     * - id     : string|null   Job id
     * - name   : string|null   logical Job name
     * - reason : string|null   optional shutdown reason
     * - tag    : string|null   lowercased DOM tag name
     * - elId   : string|null   DOM element id attribute
     *
     *
     * BOUNDING POLICY
     * ---------------
     * - If shutdownLogMax > 0, the log is truncated to the most recent
     *   shutdownLogMax entries.
     * - Oldest entries are removed first (FIFO).
     *
     *
     * FAILURE POLICY
     * --------------
     * - Never throws.
     * - Logging is best-effort and intentionally shallow.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Job instance being shut down.
     *
     * @param {Object} [info={}]
     *
     * @param {string} [info.reason]
     *   Optional human-readable shutdown reason.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not persist logs externally.
     * Does not emit events.
     * Does not mutate Job state.
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
