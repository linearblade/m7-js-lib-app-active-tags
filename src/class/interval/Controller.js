/**
 * Interval Controller
 * -------------------
 *
 * Manages interval-based pipeline triggers for ActiveTags Jobs.
 *
 * This controller separates three distinct concerns:
 *
 *   Registration   discovery of interval definitions from Job schema
 *   Enable state   logical permission for an interval to run
 *   Runtime state  whether an interval is currently active
 *
 *
 * REGISTRATION
 * ------------
 * register() and registerAll() read interval definitions from Job
 * configuration and populate the internal registry.
 *
 * Registration does not start timers.
 * Registration does not execute pipelines.
 * Registration does not modify existing runtime timers.
 *
 *
 * ENABLE STATE
 * ------------
 * An interval may be enabled or disabled.
 *
 * Enabled means the interval is allowed to run if turned on.
 * Disabled intervals will not start and will be stopped if running.
 *
 * Calling disable() guarantees the interval is not running.
 *
 *
 * RUNTIME STATE
 * -------------
 * on() activates eligible enabled intervals.
 * off() stops active intervals.
 *
 * Enabled does not imply running.
 * Running requires an explicit call to on().
 *
 *
 * REMOVAL
 * -------
 * remove(job) stops all active intervals for the Job and removes
 * its interval definitions from the registry.
 *
 *
 * IDEMPOTENCY
 * -----------
 * registerAll() may be called multiple times.
 * It updates registry definitions but does not automatically
 * restart or recreate active timers.
 *
 *
 * EXECUTION BOUNDARY
 * ------------------
 * This controller orchestrates interval lifecycle only.
 *
 * Timer scheduling is delegated to the injected interval service.
 * Pipeline execution is delegated to the Engine.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * The controller must not execute pipelines directly.
 * The controller must not manage retry logic.
 * The controller must not mutate Job configuration.
 */

export class Controller {
    /**
     * Create a new Interval Controller.
     *
     * CONTRACT
     * --------
     * The Interval Controller requires a fully initialized ActiveTags instance and
     * its core runtime dependencies. It must be constructed only after:
     *   AT.engine exists
     *   AT.svc.interval exists
     *
     * Construction performs validation and reference caching only.
     * No timers are created.
     * No pipelines are executed.
     * No registry entries are created.
     *
     *
     * REQUIRED DEPENDENCIES
     * ---------------------
     * @param {Object} opts
     *
     * @param {ActiveTags} opts.AT
     *   The owning ActiveTags instance.
     *   Must expose:
     *     engine
     *     svc.interval
     *
     * @param {Object} opts.lib
     *   The m7 lib instance used for normalization and internal utilities.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Caches stable references to AT, engine, intervalManager, and lib.
     * Initializes an empty interval registry keyed by jobId and intervalName.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if AT.engine is missing.
     * Throws if AT.svc.interval is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register intervals.
     * Does not start or stop timers.
     * Does not enqueue or execute pipelines.
     */
    constructor({ AT, lib, toJob } = {}) {
	if (!AT) throw new Error("IntervalController requires { AT }");
	if (!AT.engine) throw new Error("IntervalController requires AT.engine");
	if (!AT.svc || !AT.svc.interval) throw new Error("IntervalController requires AT.svc.interval");
	if (!lib) throw new Error("IntervalController requires { lib }");
	if (typeof toJob !== "function") throw new Error("IntervalController requires { toJob } function");

	this.AT = AT;
	this.engine = AT.engine;
	this.intervalManager = AT.svc.interval;
	this.lib = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// internal registry
	// jobId -> Map(intervalName -> state)
	this.registry = new Map();
	Object.freeze(this);
    }
    /**
     * Destroy the Interval Controller.
     *
     * CONTRACT
     * --------
     * destroy() stops all active intervals managed by this controller
     * and clears the internal registry.
     *
     * After destroy() completes:
     *   No interval managed by this controller will be running.
     *   The internal registry will be empty.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls off() to cancel all active intervals.
     * 2. Clears all registry entries.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels timers via the injected interval service.
     * Removes all tracked interval definitions from the controller.
     *
     *
     * POSTCONDITION
     * -------------
     * The controller remains instantiated but contains no registered intervals.
     * Further calls to on() will have no effect until intervals are re-registered.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected interval service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    destroy() {
	this.off();          // cancel all intervals
	this.registry.clear();
    }

    /**
     * Register interval definitions for all eligible Jobs.
     *
     * CONTRACT
     * --------
     * registerAll() scans the JobRegistry and registers interval
     * definitions for each eligible Job.
     *
     * It does not start timers.
     * It does not execute pipelines.
     * It does not enable or disable intervals.
     *
     *
     * ELIGIBILITY RULES
     * -----------------
     * A Job is processed only if:
     *   job exists
     *   job.config.schema.enable.enabled is true
     *
     * Jobs failing eligibility are skipped.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Retrieves all Jobs from AT.jobs.list().
     * 2. Filters out disabled Jobs.
     * 3. Calls register(job) for each eligible Job.
     * 4. Returns the number of Jobs processed.
     *
     *
     * IDEMPOTENCY
     * -----------
     * May be called multiple times.
     * Re-registering a Job refreshes its interval definitions in the registry.
     * Existing active timers are not automatically restarted.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of Jobs for which register(job) was invoked.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Populates or updates entries in the internal interval registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not enqueue pipelines.
     * Does not mutate Job configuration.
     */
    registerAll() {
	const lib = this.lib;
	const AT  = this.AT;

	const jobs = AT.jobs.list();
	if (!lib.array.len(jobs)) return 0;

	let count = 0;

	for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            // register all intervals for this job
            this.register(job);
            count++;
	}

	return count;
    }    
    
    /**
     * Register interval definitions for a single Job.
     *
     * CONTRACT
     * --------
     * register() reads interval definitions from a Job configuration block and
     * stores normalized interval entries in the internal registry.
     *
     * It does not start timers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     * This is a Job-scoped registry operation.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * SOURCE CONFIG
     * -------------
     * Interval definitions are read from:
     *   job.config.schema.intervals
     *
     * The intervals block is expected to be an object whose keys are interval names.
     *
     *
     * NORMALIZATION RULES
     * -------------------
     * For each interval record:
     *   enabled defaults to true unless explicitly disabled
     *   repeat must be a finite number greater than zero
     *   pipeline must be a non-empty string
     *
     * Records that fail structural requirements are skipped.
     *
     * Disabled intervals are still registered so they may be enabled later.
     *
     *
     * REGISTRY EFFECT
     * ---------------
     * Registry layout is:
     *   registry.get(jobId) returns Map(intervalName -> entry)
     *
     * Each entry contains:
     *   jobId
     *   name
     *   enabled
     *   on
     *   def
     *
     * Re-registering replaces the stored entry definition and resets on to false.
     * This method does not stop or restart any active timers.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval entries added or replaced for the Job.
     *
     *
     * FAILURE MODES
     * -------------
     * Returns 0 if jobLike cannot be resolved to a Job with an id.
     * Returns 0 if the intervals block is missing or not an object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Creates or updates registry entries for the resolved Job id.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not cancel existing timers.
     * Does not mutate Job configuration.
     */
    register(jobLike) {
	const lib = this.lib;

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const intervals = lib.hash.get(job, "config.schema.intervals");
	if (!lib.hash.is(intervals)) return 0;

	let jobEntry = this.registry.get(job.id);
	if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
	}

	let count = 0;

	for (const name in intervals) {
            const rec = lib.hash.get(intervals, name);
            if (!rec) continue;

            // keep disabled intervals too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity (register even if disabled, but only if structurally usable)
            const repeat = Number(lib.hash.get(rec, "repeat") || 0);
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!Number.isFinite(repeat) || repeat <= 0) continue;
            if (!pipeline) continue;

            jobEntry.set(name, {
		jobId: job.id,
		name,
		enabled,
		on: false,
		def: rec
            });

            count++;
	}

	return count;
    }
    
    /**
     * Remove all interval definitions for a single Job.
     *
     * CONTRACT
     * --------
     * remove() stops all active intervals for the resolved Job and
     * removes its interval entries from the internal registry.
     *
     * Removal implies off.
     * After removal, no interval for the Job will remain registered
     * or running under this controller.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. If no registry entry exists for the Job, returns 0.
     * 3. Calls off(job) to cancel any active intervals.
     * 4. Deletes the Job entry from the registry.
     * 5. Returns the number of interval definitions removed.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval entries removed for the Job.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels any active timers associated with the Job.
     * Removes all stored interval definitions for the Job.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not mutate Job configuration.
     * Does not destroy the injected interval service.
     * Does not enqueue or execute pipelines.
     */
    remove(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const count = jobEntry.size;
	
	// runtime: cancel any active intervals first
	this.off(job);
	
	this.registry.delete(job.id);

	return count;
    }

    /**
     * List interval state for a single Job.
     *
     * CONTRACT
     * --------
     * listJob() returns a snapshot of the logical and runtime state
     * of all intervals registered for a resolved Job.
     *
     * It does not mutate registry state.
     * It does not start or stop intervals.
     * It does not access the interval service.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. Retrieves the Job's interval registry entry.
     * 3. Builds and returns a plain object describing interval state.
     *
     * Each interval entry includes:
     *   enabled  logical enable state
     *   on       current runtime state
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   A plain object keyed by interval name.
     *   Each value contains:
     *     enabled boolean
     *     on      boolean
     *
     *   Returns an empty object if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not expose internal interval definitions.
     * Does not expose repeat timing or pipeline configuration.
     * Does not validate registry integrity.
     */
    listJob(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return {};

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return {};

	const out = {};

	for (const [name, entry] of jobEntry.entries()) {
            out[name] = {
		enabled: !!entry.enabled,
		on: !!entry.on,
            };
	}

	return out;
    }

    /**
     * List Jobs that have registered interval definitions.
     *
     * CONTRACT
     * --------
     * listJobs() returns identifiers for all Jobs currently present
     * in the interval registry.
     *
     * It reflects registry membership only.
     * It does not indicate whether intervals are enabled or running.
     * It does not mutate controller state.
     *
     *
     * INPUT
     * -----
     * @param {boolean} [name=true]
     *   If true, returns Job names when available.
     *   If false, returns Job ids.
     *
     *
     * BEHAVIOR
     * --------
     * Iterates over all Job ids stored in the interval registry.
     *
     * If name is false:
     *   Returns the Job id for each entry.
     *
     * If name is true:
     *   Attempts to resolve the Job and return:
     *     job.name if present
     *     otherwise job.config.schema.name if present
     *     otherwise the Job id
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   An array of Job identifiers.
     *   Each entry corresponds to a Job that has at least one
     *   registered interval definition.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate Job existence beyond toJob resolution.
     * Does not expose interval configuration details.
     * Does not indicate runtime state.
     */
    listJobs(name = true) {
	const lib = this.lib;
	const out = [];

	for (const jobId of this.registry.keys()) {
            if (!name) {
		out.push(jobId);
		continue;
            }

            const job = this.toJob(jobId);

            // Prefer configured job name; fall back to id.
            const jobName =
		  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
		  null;

            out.push(jobName || jobId);
	}

	return out;
    }    
    
    /**
     * Activate interval timers for registered interval definitions.
     *
     * CONTRACT
     * --------
     * on() starts runtime interval timers for enabled interval entries.
     *
     * It does not execute pipelines directly.
     * It schedules timers through the injected interval service.
     * Pipeline execution is delegated to the Engine when ticks occur.
     *
     * Disabled intervals are never started.
     * Intervals that are already running are not duplicated.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, on() applies globally to all Jobs in the registry.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If provided and non-empty, only that interval name is targeted.
     *   If omitted or empty, all intervals for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to activate intervals for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its interval map from the registry.
     *
     * Interval selection
     *   If intervalName is provided, attempts to activate that single interval.
     *   Otherwise attempts to activate all registered intervals for the Job.
     *
     * Activation is delegated to the internal _onOne(job, name) helper.
     * _onOne is responsible for enforcing enable state and preventing duplicates.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval timers successfully activated.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create runtime timers through the injected interval service.
     * May update registry runtime state for activated intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not change enable state.
     * Does not validate pipeline existence.
     * Does not enqueue pipelines directly.
     */
    on(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn on all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._onOne(job, intervalName);
	}

	// all intervals for job (only ones that are enabled will actually turn on)
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _onOne() is the internal activation primitive for a single interval entry.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use on() and off().
     *
     *
     * CONTRACT
     * --------
     * _onOne() attempts to start exactly one interval timer for a Job and interval name.
     *
     * It enforces all activation gates:
     *   Job must resolve and have an id
     *   intervalName must be a non-empty string
     *   interval entry must exist in the registry
     *   entry.enabled must be true
     *   entry.on must be false
     *   rec.repeat must be a finite number greater than zero
     *   rec.pipeline must be a non-empty string
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * RUNTIME BINDING
     * ---------------
     * A stable runtime identifier is computed as:
     *   at:jobId:intervalName
     *
     * This runtimeName is used as the key for the injected interval service.
     * It must remain stable so off() can reliably stop and unregister timers.
     *
     *
     * INTERVAL SERVICE CONTRACT
     * -------------------------
     * This method assumes AT.svc.interval provides:
     *   register({ name, everyMs, maxRuns, overlapPolicy, errorPolicy, fn })
     *   start(name)
     *
     * Overlap policy mapping:
     *   allowOverlap true  maps to overlapPolicy queue
     *   allowOverlap false maps to overlapPolicy coalesce
     *
     * Error policy mapping:
     *   onError stop  maps to errorPolicy pause
     *   otherwise     maps to errorPolicy continue
     *
     *
     * EXECUTION BOUNDARY
     * ------------------
     * The interval callback does not run pipelines directly.
     *
     * It enqueues work into the Engine:
     *   reason is interval
     *   intervalName is the logical key
     *   interval is the interval service context object
     *
     * The callback performs a scoped engine drain for the single ticket.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Registers a timer with the interval service.
     * Starts the timer immediately.
     * Mutates the registry entry runtime state:
     *   entry.on is set to true
     *   entry.runtimeName is set to the stable runtime identifier
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must remain deterministic and gate-driven.
     * It must not create duplicate timers for the same interval entry.
     * It must not mutate Job configuration.
     */
    _onOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// logical gate
	if (lib.bool.no(entry.enabled)) return 0;

	// already on
	if (lib.bool.yes(entry.on)) return 0;

	const rec = entry.def || {};

	const everyMs = Number(lib.hash.get(rec, "repeat") || 0);
	const maxRuns = Number(lib.hash.get(rec, "max") || 0) || 0;

	const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
	if (!pipeline) return 0;

	if (!Number.isFinite(everyMs) || everyMs <= 0) return 0;

	const allowOverlap = lib.bool.yes(lib.hash.get(rec, "allowOverlap"));
	const overlapPolicy = allowOverlap ? "queue" : "coalesce";

	const onError = lib.str.to(lib.hash.get(rec, "onError"), true).trim().toLowerCase();
	const errorPolicy = (onError === "stop") ? "pause" : "continue";

	// unique, stable runtime id for IntervalManager
	const runtimeName = `at:${job.id}:${intervalName}`;

	const engine = this.engine;
	const mgr = this.intervalManager;

	mgr.register({
            name: runtimeName,
            everyMs,
            maxRuns,
            overlapPolicy,
            errorPolicy,
            fn: (ctx) => {
		const ticket = engine.enqueue(job, pipeline, {
                    inputs: {
			reason: "interval",
			intervalName,
			interval: ctx,
                    },
                    meta: {
			source: "interval",
			intervalKey: intervalName,
			intervalName: runtimeName,
                    },
		});

		// scoped drain (only this ticket)
		engine.drain({ ticket });
            },
	});

	mgr.start(runtimeName);

	// mark runtime state
	entry.on = true;
	entry.runtimeName = runtimeName;

	return 1;
    }   

    /**
     * Deactivate interval timers for registered interval definitions.
     *
     * CONTRACT
     * --------
     * off() stops runtime interval timers previously activated by on().
     *
     * It does not execute pipelines.
     * It does not enqueue pipelines.
     * It does not modify enable state.
     *
     * Calling off() is safe even if the targeted interval is not running.
     * Intervals that are not running result in no action and contribute 0 to the count.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, off() applies globally to all Jobs in the registry.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If provided and non-empty, only that interval name is targeted.
     *   If omitted or empty, all intervals for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to deactivate intervals for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its interval map from the registry.
     *
     * Interval selection
     *   If intervalName is provided, attempts to deactivate that single interval.
     *   Otherwise attempts to deactivate all registered intervals for the Job.
     *
     * Deactivation is delegated to the internal _offOne(job, name) helper.
     * _offOne is responsible for stopping the runtime timer and updating registry state.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval timers successfully deactivated.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May stop runtime timers through the injected interval service.
     * May update registry runtime state for deactivated intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove interval definitions from the registry.
     * Does not change enable state.
     * Does not validate pipeline existence.
     */
    off(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn off all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.off(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._offOne(job, intervalName);
	}

	// all intervals for job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _offOne() is the internal deactivation primitive for a single interval entry.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use off() and remove().
     *
     *
     * CONTRACT
     * --------
     * _offOne() attempts to stop exactly one active interval timer for a Job and
     * interval name.
     *
     * It enforces all deactivation gates:
     *   Job must resolve and have an id
     *   intervalName must be a non-empty string
     *   interval entry must exist in the registry
     *   entry.on must be true
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * RUNTIME NAME RESOLUTION
     * -----------------------
     * The runtime identifier used by the interval service is resolved as:
     *   entry.runtimeName when present
     *   otherwise the computed fallback at:jobId:intervalName
     *
     * This stability guarantee ensures off() can cancel timers even if the entry
     * was partially reconstructed, as long as the naming scheme remains stable.
     *
     *
     * INTERVAL SERVICE CONTRACT
     * -------------------------
     * This method assumes the injected interval service provides:
     *   cancel(name)
     *
     * cancel() is treated as a full cancellation mechanism because on() registers
     * the interval definition before starting it.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels the runtime timer through the injected interval service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to false
     *   entry.runtimeName is cleared
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not alter enable state.
     * This method must not remove registry entries.
     * This method must not enqueue or execute pipelines.
     */
    _offOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// already off
	if (lib.bool.no(entry.on)) return 0;

	// stable runtime name (prefer stored)
	const runtimeName = entry.runtimeName || `at:${job.id}:${intervalName}`;

	// runtime effect: fully cancel (since on() registers)
	this.intervalManager.cancel(runtimeName);

	// registry update
	entry.on = false;
	entry.runtimeName = null;

	return 1;
    }    

    /**
     * Logically enable interval definitions for a Job.
     *
     * CONTRACT
     * --------
     * enable() marks interval definitions as eligible to run.
     *
     * It does not start timers.
     * It does not enqueue pipelines.
     * It does not change runtime state.
     *
     * An enabled interval will only begin executing if on() is called.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If omitted or falsy, all intervals for the Job are enabled.
     *   If provided, only the specified interval is enabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its interval registry entry.
     *
     * If intervalName is omitted:
     *   Sets enabled to true for all interval entries of the Job.
     *
     * If intervalName is provided:
     *   Sets enabled to true for the specified interval entry.
     *
     * No runtime timers are started automatically.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one interval enable state was changed.
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *     the specified interval does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates the logical enable state in the internal registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not cancel running intervals.
     * Does not remove registry entries.
     * Does not mutate Job configuration.
     */
    enable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// enable ALL intervals for this job
	if (!intervalName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
		if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
		}
            }
            return changed;
	}

	// enable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	entry.enabled = true;
	return true;
    }    

    /**
     * Logically disable interval definitions for a Job.
     *
     * CONTRACT
     * --------
     * disable() marks interval definitions as ineligible to run.
     *
     * Disabling implies off.
     * If a targeted interval is currently running, it will be stopped.
     *
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If omitted or falsy, all intervals for the Job are disabled.
     *   If provided, only the specified interval is disabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its interval registry entry.
     *
     * If intervalName is omitted:
     *   For each interval entry:
     *     Stops the interval if it is running.
     *     Sets enabled to false.
     *
     * If intervalName is provided:
     *   Stops the interval if it is running.
     *   Sets enabled to false.
     *
     * Runtime cancellation is performed via the internal _offOne() helper.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one interval changed state.
     *   A change includes:
     *     enabled changed from true to false
     *     a running interval was stopped
     *
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *     the specified interval does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * May cancel running timers through the injected interval service.
     * Mutates the logical enable state in the internal registry.
     * Updates runtime state for stopped intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove interval definitions from the registry.
     * Does not mutate Job configuration.
     * Does not validate pipeline existence.
     */
    disable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// disable ALL intervals for this job
	if (!intervalName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
		// runtime: if it's on, cancel it
		if (entry.on) this._offOne(job, name);

		// logical: disable
		if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
		} else if (entry.on) {
                    // (should already be false after _offOne, but counts as change)
                    changed = true;
		}
            }

            return changed;
	}

	// disable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	// runtime: if it's on, cancel it
	if (entry.on) this._offOne(job, intervalName);

	// logical: disable
	const wasEnabled = !!entry.enabled;
	entry.enabled = false;

	return wasEnabled || entry.on;
    }
    
}


export default Controller;
