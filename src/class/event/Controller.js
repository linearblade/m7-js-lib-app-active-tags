/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Event Controller
 * ----------------
 *
 * Manages delegated DOM event to pipeline bindings for ActiveTags Jobs.
 * Runtime bindings are installed through the injected EventDelegator service.
 *
 * This controller separates three distinct concerns:
 *
 *   Registration   discovery of event definitions from Job schema
 *   Enable state   logical permission for an event binding to be installed
 *   Runtime state  whether a delegated handler is currently installed
 *
 *
 * REGISTRATION
 * ------------
 * register() and registerAll() read event definitions from Job configuration
 * and populate the internal registry.
 *
 * Registration does not install delegated handlers.
 * Registration does not enqueue pipelines.
 * Registration does not execute pipelines.
 *
 *
 * ENABLE STATE
 * ------------
 * An event binding may be enabled or disabled.
 *
 * Enabled means the binding may be installed when on() is called.
 * Disabled bindings will not be installed and will be uninstalled if running.
 *
 * Calling disable() guarantees the binding is not installed.
 *
 *
 * RUNTIME STATE
 * -------------
 * on() installs eligible enabled delegated handlers.
 * off() uninstalls delegated handlers.
 *
 * Enabled does not imply installed.
 * Installed requires an explicit call to on().
 *
 *
 * REMOVAL
 * -------
 * remove(job) uninstalls all installed handlers for the Job and removes
 * its event definitions from the registry.
 *
 *
 * IDEMPOTENCY
 * -----------
 * registerAll() may be called multiple times.
 * It updates registry definitions but does not automatically reinstall
 * delegated handlers.
 *
 *
 * SEMANTIC NORMALIZATION
 * ----------------------
 * Event types may require normalization for delegated handling.
 * normalizeEventType() converts configured types into delegator-safe types.
 *
 * Some events require semantic filtering to avoid internal transitions
 * triggering pipelines.
 *
 * ActiveTags-owned selector resolution and matched-only event behavior
 * are applied inside the runtime handler after selector relevance is
 * confirmed for the current event.
 * setupEventHandler() routes special semantic cases through
 * SPECIAL_EVENT_HANDLERS so _onOne remains generic.
 *
 *
 * EXECUTION BOUNDARY
 * ------------------
 * This controller installs and removes delegated handlers only.
 *
 * Event delegation is provided by the injected delegator service.
 * Pipeline execution is delegated to the Engine.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * The controller must not execute pipelines directly.
 * The controller must not mutate Job configuration.
 * The controller must not implement scheduling or retry logic.
 *///use named import, default isnt iterable and doesnt play nice.
import { resolveMatchedTarget, SPECIAL_EVENT_HANDLERS } from './specialHandlers.js';
import { normalizeEventType } from './typeNormalizers.js';

const AT_MATCHED_STOP_FLAG = "__activetagsMatchedStop";

export class Controller {
    /**
     * Create a new Event Controller.
     *
     * CONTRACT
     * --------
     * The Event Controller requires a fully initialized ActiveTags instance and
     * its core runtime dependencies. It must be constructed only after:
     *   AT.engine exists
     *   AT.svc.delegator exists
     *
     * Construction performs validation and reference caching only.
     * No delegated handlers are installed.
     * No pipelines are enqueued or executed.
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
     *     svc.delegator
     *
     * @param {Object} opts.lib
     *   The m7 lib instance used for normalization and internal utilities.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     * @param {string|Array<string>} opts.selector
     *   Root delegation selector used by the EventDelegator service.
     *   This value is required and must resolve to at least one non-empty string.
     *   If an array is provided, it is normalized and joined with a comma.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Normalizes selector input into a single delegation selector string.
     * Caches stable references to AT, engine, delegator, lib, and toJob.
     * Initializes an empty event registry keyed by jobId and eventName.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if AT.engine is missing.
     * Throws if AT.svc.delegator is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     * Throws if selector is missing or normalizes to an empty string.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register event definitions.
     * Does not install delegated handlers.
     * Does not enqueue or execute pipelines.
     */
    constructor({ AT, lib, toJob, selector } = {}) {
	if (!AT) throw new Error("EventController requires { AT }");
	if (!AT.engine) throw new Error("EventController requires AT.engine");
	if (!AT.svc || !AT.svc.delegator) throw new Error("EventController requires AT.svc.delegator");
	if (!lib) throw new Error("EventController requires { lib }");
	if (typeof toJob !== "function") throw new Error("EventController requires { toJob } function");

	// REQUIRED: root delegation selector (no default)
	let selectors = lib.array.to(selector);
	selectors = lib.array.filterStrings(selectors); // trims + removes non-strings

	const rootSelector = selectors.join(", ");
	if (!rootSelector) {
	    throw new Error("EventController requires { selector } (root delegation selector)");
	}

	this.selector = rootSelector;
	
	//selector = lib.str.to(selector, true).trim();
	//if (!selector) throw new Error("EventController requires { selector } (root delegation selector)");
	//this.selector  = selector;
	
	this.AT        = AT;
	this.engine    = AT.engine;
	this.delegator = AT.svc.delegator;
	this.lib       = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// jobId -> Map(eventName -> state)
	this.registry = new Map();

	Object.freeze(this);
    }

    /**
     * Destroy the Event Controller.
     *
     * CONTRACT
     * --------
     * destroy() uninstalls all delegated event handlers managed by this
     * controller and clears the internal registry.
     *
     * After destroy() completes:
     *   No delegated handlers installed by this controller will remain active.
     *   The internal event registry will be empty.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls off() with no arguments to uninstall all active handlers.
     * 2. Clears all registry entries.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Removes delegated handlers through the injected delegator service.
     * Discards all stored event definitions in the controller registry.
     *
     *
     * POSTCONDITION
     * -------------
     * The controller remains instantiated but contains no registered
     * or active event bindings.
     * Further calls to on() will have no effect until events are re-registered.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected delegator service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    destroy() {
        this.off(); // uninstall everything (runtime)
        this.registry.clear();
    }

    /**
     * Register event definitions for all eligible Jobs.
     *
     * CONTRACT
     * --------
     * registerAll() scans the JobRegistry and registers event definitions
     * for each eligible Job.
     *
     * It does not install delegated handlers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
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
     * Re-registering a Job refreshes its event definitions in the registry.
     * Existing installed handlers are not automatically reinstalled.
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
     * Populates or updates entries in the internal event registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not uninstall existing handlers.
     * Does not mutate Job configuration.
     */
    
    registerAll() {
        const lib = this.lib;
        const AT = this.AT;

        const jobs = AT.jobs.list();
        if (!lib.array.len(jobs)) return 0;

        let count = 0;

        for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            this.register(job);
            count++;
        }

        return count;
    }

    /**
     * Register event definitions for a single Job.
     *
     * CONTRACT
     * --------
     * register() reads event definitions from a Job configuration block and
     * stores normalized event entries in the internal registry.
     *
     * It does not install delegated handlers.
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
     * Event definitions are read from:
     *   job.config.schema.events
     *
     * The events block is expected to be an object whose keys are event binding names.
     *
     *
     * NORMALIZATION RULES
     * -------------------
     * For each event record:
     *   enabled defaults to true unless explicitly disabled
     *   event must be a non-empty string and is normalized to lowercase
     *   pipeline must be a non-empty string
     *
     * Records that fail structural requirements are skipped.
     *
     * Disabled bindings are still registered so they may be enabled later.
     *
     *
     * REGISTRY EFFECT
     * ---------------
     * Registry layout is:
     *   registry.get(jobId) returns Map(bindingName -> entry)
     *
     * Each entry contains:
     *   jobId
     *   name
     *   enabled
     *   on
     *   def
     *   runtimeTag
     *   offFn
     *
     * Re-registering replaces the stored entry definition and resets on to false.
     * This method does not uninstall or reinstall any active delegated handlers.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of event entries added or replaced for the Job.
     *
     *
     * FAILURE MODES
     * -------------
     * Returns 0 if jobLike cannot be resolved to a Job with an id.
     * Returns 0 if the events block is missing or not an object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Creates or updates registry entries for the resolved Job id.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not install delegated handlers.
     * Does not mutate Job configuration.
     */
    register(jobLike) {
        const lib = this.lib;

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const events = lib.hash.get(job, "config.schema.events");
        if (!lib.hash.is(events)) return 0;

        let jobEntry = this.registry.get(job.id);
        if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
        }

        let count = 0;

        for (const name in events) {
            const rec = lib.hash.get(events, name);
            if (!rec) continue;

            // keep disabled too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity: must have event type + pipeline
            const eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!eventType || !pipeline) continue;

            jobEntry.set(name, {
                jobId: job.id,
                name,
                enabled,
                on: false,
                def: rec,

                // runtime (filled by on/off)
                runtimeTag: null,
                offFn: null,
            });

            count++;
        }

        return count;
    }

    /**
     * Remove all event definitions for a single Job.
     *
     * CONTRACT
     * --------
     * remove() uninstalls all delegated event handlers for the resolved Job
     * and removes its event definitions from the internal registry.
     *
     * Removal implies off.
     * After removal, no event binding for the Job will remain registered
     * or installed under this controller.
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
     * 3. Calls off(job) to uninstall any active delegated handlers.
     * 4. Deletes the Job entry from the registry.
     * 5. Returns the number of event definitions removed.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of event entries removed for the Job.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Uninstalls delegated handlers through the injected delegator service.
     * Removes all stored event definitions for the Job.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected delegator service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    remove(jobLike) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const count = jobEntry.size;

        // runtime: uninstall any active handlers first
        this.off(job);

        // registry: remove entire job entry
        this.registry.delete(job.id);

        return count;
    }

    /**
     * List event binding state for a single Job.
     *
     * CONTRACT
     * --------
     * listJob() returns a snapshot of the logical and runtime state
     * of all event bindings registered for a resolved Job.
     *
     * It does not mutate registry state.
     * It does not install or uninstall delegated handlers.
     * It does not access the delegator service.
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
     * 2. Retrieves the Job's event registry entry.
     * 3. Builds and returns a plain object describing event binding state.
     *
     * Each event entry includes:
     *   enabled  logical enable state
     *   on       current runtime installation state
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   A plain object keyed by event binding name.
     *   Each value contains:
     *     enabled boolean
     *     on      boolean
     *
     *   Returns an empty object if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not expose internal event definitions.
     * Does not expose runtime tags or off functions.
     * Does not validate registry integrity.
     */
    listJob(jobLike) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return {};

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return {};

        const out = {};
        for (const [name, entry] of jobEntry.entries()) {
            out[name] = { enabled: !!entry.enabled, on: !!entry.on };
        }
        return out;
    }

    /**
     * List Jobs that have registered event bindings.
     *
     * CONTRACT
     * --------
     * listJobs() returns identifiers for all Jobs currently present
     * in the event registry.
     *
     * It reflects registry membership only.
     * It does not indicate whether bindings are enabled or installed.
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
     * Iterates over all Job ids stored in the event registry.
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
     *   registered event definition.
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
     * Does not expose event configuration details.
     * Does not indicate runtime installation state.
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
            const jobName =
                  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
                  null;

            out.push(jobName || jobId);
        }

        return out;
    }

    /**
     * Logically enable event bindings for a Job.
     *
     * CONTRACT
     * --------
     * enable() marks event bindings as eligible to be installed.
     *
     * It does not install delegated handlers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     * An enabled event binding will only be installed if on() is called.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [eventName]
     *   Optional event binding name.
     *   If omitted or falsy, all event bindings for the Job are enabled.
     *   If provided, only the specified binding is enabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its event registry entry.
     *
     * If eventName is omitted:
     *   Sets enabled to true for all event entries of the Job.
     *
     * If eventName is provided:
     *   Sets enabled to true for the specified event entry.
     *
     * No delegated handlers are installed automatically.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one binding changed state.
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *     the specified event does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates the logical enable state in the internal registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not uninstall handlers.
     * Does not mutate Job configuration.
     */
    enable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // enable ALL events for this job
        if (!eventName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
                if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
                }
            }
            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        entry.enabled = true;
        return true;
    }

    /**
     * Logically disable event bindings for a Job.
     *
     * CONTRACT
     * --------
     * disable() marks event bindings as ineligible to be installed.
     *
     * Disabling implies off.
     * If a targeted binding is currently installed, it will be uninstalled.
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
     * @param {string} [eventName]
     *   Optional event binding name.
     *   If omitted or falsy, all event bindings for the Job are disabled.
     *   If provided, only the specified binding is disabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its event registry entry.
     *
     * If eventName is omitted:
     *   For each event entry:
     *     Uninstalls the handler if it is installed.
     *     Sets enabled to false.
     *
     * If eventName is provided:
     *   Uninstalls the handler if it is installed.
     *   Sets enabled to false.
     *
     * Runtime uninstallation is performed via the internal _offOne() helper.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one binding changed state.
     *   A change includes enabled changing from true to false.
     *
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *     the specified event does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * May uninstall delegated handlers through the injected delegator service.
     * Mutates the logical enable state in the internal registry.
     * Updates runtime state for uninstalled bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove event definitions from the registry.
     * Does not mutate Job configuration.
     * Does not validate pipeline existence.
     */
    disable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // disable ALL events for this job
        if (!eventName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
                if (entry.on) this._offOne(job, name);

                if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
                }
            }

            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        if (entry.on) this._offOne(job, eventName);

        const wasEnabled = !!entry.enabled;
        entry.enabled = false;
        return wasEnabled;
    }

    /**
     * Internal helper: enqueue a synthetic require-gated conditional-on ticket for one event binding.
     *
     * @param {Object} job
     * @param {*} eventName
     * @param {Object} [opts]
     * @returns {Promise<number>}
     *   1 when a conditional ticket was enqueued, otherwise 0.
     */
    async _conditionalOnOne(job, eventName, opts = {}) {
	const lib = this.lib;
	const engine = this.engine;
	if (!job || !job.id) return 0;

	eventName = lib.str.to(eventName, true).trim();
	if (!eventName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(eventName);
	if (!entry) return 0;

	// Mirror _onOne gates as closely as possible.
	if (lib.bool.no(entry.enabled)) return 0;
	if (lib.bool.yes(entry.on)) return 0;

	const rec = entry.def || {};
	let eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
	eventType = normalizeEventType(eventType);
	const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
	if (!eventType || !pipeline) return 0;

	const internalKey = `__eventController_event_${job.id}_${eventName}`;

	const runHandler = ({ inputs } = {}) => {
	    const targetJob = this.toJob(inputs?.jobId || job.id) || job;
	    const targetEvent = lib.str.to(inputs?.eventName, true).trim() || eventName;
	    this.on(targetJob, targetEvent);
	    return true;
	};

	const errorHandler = ({ inputs } = {}) => {
	    if (inputs && typeof inputs === "object") {
		inputs.eventControllerError = true;
	    }
	    return true;
	};

	const optHash = lib.hash.to(opts);
	const sourceRequire = lib.array.to(lib.hash.get(job, "config.schema.require"));
	const extraRequire = lib.array.to(lib.hash.get(optHash, "require"));
	const require = Array.from(new Set([...sourceRequire, ...extraRequire]));

	const def = {
	    enabled: true,
	    autorun: true,
	    require,
	    pipeline: {
		run: [runHandler],
		error: [errorHandler],
	    },
	};

	const runtime = this.AT && this.AT.runtime;
	if (!runtime || typeof runtime.createInternalJob !== "function") return 0;

	const internal = await runtime.createInternalJob(internalKey, def, { domain: "event", e: job.e });
	if (!internal || !internal.job || !internal.job.id) return 0;

	const ticket = engine.enqueue(internal.job, "default", {
	    inputs: {
		reason: "event.conditionalOn",
		jobId: job.id,
		eventName,
	    },
	    meta: {
		source: "event-controller",
		type: "conditionalOn",
		identifier: internal.identifier,
	    },
	});

	return ticket ? 1 : 0;
    }

    /**
     * Conditionally install event bindings through synthetic require-gated tickets.
     *
     * Behavior mirrors on():
     * - Global mode when no jobLike is provided.
     * - Single-binding mode when eventName is provided.
     * - All-bindings mode for a resolved job otherwise.
     *
     * Instead of calling _onOne(), this delegates to _conditionalOnOne().
     *
     * @param {Object|string|Element|null} [jobLike]
     * @param {string} [eventName]
     * @param {Object} [opts]
     * @returns {Promise<number>}
     *   Number of event bindings for which a conditional ticket enqueue succeeded.
     */
    async conditionalOn(jobLike, eventName, opts = {}) {
	const lib = this.lib;

	// GLOBAL: conditionally turn on all events for all jobs
	if (!jobLike) {
	    let count = 0;
	    for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += await this.conditionalOn(job, eventName, opts);
	    }
	    return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single event
	if (lib.str.to(eventName, true).trim()) {
	    return await this._conditionalOnOne(job, eventName, opts);
	}

	// all events for this job
	let count = 0;
	for (const name of jobEntry.keys()) {
	    count += await this._conditionalOnOne(job, name, opts);
	}

	return count;
    }

    /**
     * Install delegated event handlers for registered event bindings.
     *
     * CONTRACT
     * --------
     * on() installs delegated handlers for enabled event bindings.
     *
     * It does not execute pipelines directly.
     * It installs handlers through the injected delegator service.
     * Pipeline execution is delegated to the Engine when events fire.
     *
     * Disabled bindings are never installed.
     * Bindings that are already installed are not duplicated.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, on() applies globally to all Jobs in the registry.
     *
     * @param {string} [eventName]
     *   Optional event binding name selector.
     *   If provided and non-empty, only that binding name is targeted.
     *   If omitted or empty, all bindings for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to install bindings for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its event map from the registry.
     *
     * Binding selection
     *   If eventName is provided, attempts to install that single binding.
     *   Otherwise attempts to install all registered bindings for the Job.
     *
     * Installation is delegated to the internal _onOne(job, name) helper.
     * _onOne is responsible for enforcing enable state and preventing duplicates.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of delegated handlers successfully installed.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May install delegated handlers through the injected delegator service.
     * May update registry runtime state for installed bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not change enable state.
     * Does not validate pipeline existence.
     * Does not enqueue pipelines directly.
     */
    on(jobLike, eventName) {
	const lib = this.lib;

	// GLOBAL: turn on all events for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, eventName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single event
	if (lib.str.to(eventName, true).trim()) {
            return this._onOne(job, eventName);
	}

	// all events for this job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _onOne() is the internal installation primitive for a single event binding.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use on() and off().
     *
     *
     * CONTRACT
     * --------
     * _onOne() attempts to install exactly one delegated handler for a Job and
     * event binding name.
     *
     * It enforces all installation gates:
     *   Job must resolve and have an id
     *   eventName must be a non-empty string
     *   event entry must exist in the registry
     *   entry.enabled must be true
     *   entry.on must be false
     *   rec.event must normalize to a non-empty eventType
     *   rec.pipeline must be a non-empty string
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * TYPE NORMALIZATION
     * ------------------
     * The configured event type is normalized to lowercase and passed through
     * normalizeEventType() to produce a delegator-safe eventType.
     *
     *
     * SEMANTIC HANDLERS
     * -----------------
     * setupEventHandler() is used as an explicit semantic normalization step.
     * It may return a wrapper handler for special event types while keeping
     * delegation installation generic.
     *
     *
     * RUNTIME TAGGING
     * --------------
     * A stable runtime tag is computed as:
     *   at:event:jobId:eventName
     *
     * This tag is passed to the delegator and stored in the registry entry.
     * The tag enables teardown by tag-based removal and supports debugging.
     *
     *
     * DELEGATOR CONTRACT
     * ------------------
     * This method assumes the injected delegator service provides:
     *   on({ eventType, selector, options, policy, tag, handler }) -> offFn
     *
     * offFn must uninstall the delegated handler installed by this call.
     *
     *
     * EXECUTION BOUNDARY
     * ------------------
     * The delegated handler must not execute pipelines directly.
     * It must enqueue into the Engine and delegate execution to Engine drain.
     *
     * That behavior is implemented by setupEventHandler() and any special handlers.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Installs a delegated handler through the injected delegator service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to true
     *   entry.runtimeTag is set to the stable runtime tag
     *   entry.offFn is set to the delegator uninstall function
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not create duplicate handlers for the same binding.
     * This method must not mutate Job configuration.
     * This method must remain gate-driven and deterministic.
     */
    _onOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // logical gate
        if (lib.bool.no(entry.enabled)) return 0;

        // already on
        if (lib.bool.yes(entry.on)) return 0;

        const rec = entry.def || {};

        let eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
	eventType = normalizeEventType(eventType);
        const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
        if (!eventType || !pipeline) return 0;

        const listener = lib.hash.to(lib.hash.get(rec, "listener"));
        const options = lib.hash.to(lib.hash.get(listener, "options"));
        const rawPolicy = lib.hash.to(lib.hash.get(listener, "policy"));
        const policy = Object.assign({}, rawPolicy);
        delete policy.match;
        delete policy.stop;
        delete policy.prevent;

        // TEMP (portable): anchor delegation to ActiveTags elements.
        // Later: job-scoped selectors/subselectors.
        const selector = this.selector;

        // tag enables teardown via offTag() without needing handler refs
        const runtimeTag = `at:event:${job.id}:${eventName}`;

        const handler = this.setupEventHandler({
            job,
            eventName,
            eventType,
            pipeline,
            rec,
        });

        // install delegated handler
        const offFn = this.delegator.on({
            eventType,
            selector,
            options,
            policy,
            tag: runtimeTag,
            handler,
        });

        // mark runtime state
        entry.on = true;
        entry.runtimeTag = runtimeTag;
        entry.offFn = offFn;

        return 1;
    }



    /**
     * Build a delegator-compatible handler for a single event binding.
     *
     * CONTRACT
     * --------
     * setupEventHandler() returns a function intended to be installed by the
     * EventDelegator service. The delegator calls this handler with:
     *   this bound to the matched ActiveTags root element
     *   the DOM Event object as the first argument
     *
     * The returned handler enqueues the configured pipeline into the Engine
     * when the binding is triggered, then schedules a scoped drain.
     *
     * It does not execute pipelines directly.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Job} args.job
     *   The owning Job for this binding.
     *   The handler enforces that the matched element belongs to this Job.
     *
     * @param {string} args.eventName
     *   The event binding name as stored in the controller registry.
     *
     * @param {string} args.eventType
     *   The normalized delegator-safe event type for installation and metadata.
     *
     * @param {string} args.pipeline
     *   The pipeline key to enqueue when the event fires.
     *
     * @param {Object} args.rec
     *   The original event record from Job schema.
     *   May include selector for sub-delegation filtering.
     *
     *
     * MATCHED SEMANTICS
     * --------------
     * If rec.selector is provided, it is treated as a trigger filter.
     * ActiveTags resolves selector relevance using `rec.matched.match`.
     *
     * If `rec.matched.prevent` is enabled, preventDefault() is called only
     * after selector relevance is confirmed and after special-event filters
     * allow the event to proceed.
     *
     * If `rec.matched.stop` is enabled, stopImmediatePropagation() is called
     * only after selector relevance is confirmed and after special-event
     * filters allow the event to proceed.
     *
     * In that case:
     *   The handler requires the event target to be within the Job root element.
     *   The handler requires the event target to resolve against rec.selector
     *   using the configured matched.match mode.
     *   The semantic trigger becomes the matched sub-element rather than the Job root.
     *
     *
     * SPECIAL EVENT ROUTING
     * ---------------------
     * Before normal enqueue behavior, the handler calls:
     *   _handleSpecialEvent({ el, e, eventType, subSelector })
     *
     * If that function returns true, the event is considered consumed and the
     * normal enqueue path is skipped.
     *
     * This keeps semantic edge cases out of the main enqueue path.
     *
     *
     * ENGINE ENQUEUE
     * --------------
     * On a normal trigger, the handler enqueues:
     *   engine.enqueue(job, pipeline, { inputs, meta })
     *
     * inputs include:
     *   reason     "event"
     *   eventName  binding name
     *   event      the DOM event object
     *   trigger    Job root element or matched sub-element
     *
     * meta includes:
     *   source       "delegator"
     *   eventType    normalized event type
     *   eventName    binding name
     *   subSelector  selector string or null
     *
     * Drain is scheduled asynchronously to avoid reentrancy and allow coalescing:
     *   Promise.resolve().then(async () => {
     *     await AT.engine.drain({ ticket, ctx: {} });
     *     await AT.engine.drain({ requireJob: job, ctx: {}, max: 25 });
     *   })
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Function}
     *   A delegator-compatible handler function.
     *
     *
     * SIDE EFFECTS
     * ------------
     * When invoked by the delegator, may enqueue a ticket and schedule a drain.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate pipeline existence.
     * Does not mutate Job configuration.
     * Does not install or uninstall delegated handlers.
     * Installation and teardown are handled by _onOne() and _offOne().
     */
    setupEventHandler({ job, eventName, eventType, pipeline, rec } = {}) {
	const engine = this.engine;
	const AT = this.AT;
	const lib = this.lib;


	// optional sub-selector (trigger filter)
	let subSelector = lib.str.to(lib.hash.get(rec, "selector"), true).trim();
	if (subSelector === "__SELF__") subSelector = "";

	// ActiveTags matched-only runtime policy
	const matched = lib.hash.to(lib.hash.get(rec, "matched"));
	let matchMode = lib.str.to(lib.hash.get(matched, "match"), true).trim().toLowerCase();
	if (!["closest", "target"].includes(matchMode)) matchMode = "closest";
	const matchedPrevent = lib.bool.yes(lib.hash.get(matched, "prevent"));
	const matchedStop = lib.bool.yes(lib.hash.get(matched, "stop"));

	// capture controller for helpers without touching handler `this`
	const self = this;

	return function handler(e) {
            if (e && e[AT_MATCHED_STOP_FLAG]) return;

            const el = this; // matched ActiveTag element (delegator contract)
            let trigger = el; // default trigger is the ActiveTag root

            // ensure correct job ownership
            if (job.e && el !== job.e) return;

            // matched selector gate
            if (subSelector) {
		const hit = resolveMatchedTarget({
		    el,
		    node: e && e.target,
		    subSelector,
		    matchMode,
		});
		if (!hit) return;

		// semantic trigger is the matched sub-element
		trigger = hit;
            }

            // ---- special-case routing (keeps main handler clean) ----
            if (self._handleSpecialEvent({ el, e, eventType, subSelector, matchMode })) {
		return; // special case consumed it
            }

            // ---- matched-only event policy ----
            if (matchedPrevent && e && typeof e.preventDefault === "function") {
		e.preventDefault();
            }
            if (matchedStop && e && typeof e.stopImmediatePropagation === "function") {
		e.stopImmediatePropagation();
		e[AT_MATCHED_STOP_FLAG] = true;
            }

            // ---- normal behavior ----
            const ticket = engine.enqueue(job, pipeline, {
		inputs: {
                    reason: "event",
                    eventName,
                    event: e,
		    trigger
		},
		meta: {
                    source: "delegator",
                    eventType,
                    eventName,
                    subSelector: subSelector || null,
		},
            });

            // pass trigger through ctx for ops/runtime use
            Promise.resolve().then(async () => {
		await AT.engine.drain({ ticket, ctx: {} });
		await AT.engine.drain({ requireJob: job, ctx: {}, max: 25 });
		AT.engine.wake.refresh();
            });
		};
	    }

    /**
     * Developer note
     * --------------
     * _handleSpecialEvent() routes event contexts through registered
     * special-case handlers.
     *
     * This method is intentionally private.
     * It exists to isolate semantic edge-case handling from the main
     * event enqueue path.
     *
     *
     * CONTRACT
     * --------
     * Iterates through SPECIAL_EVENT_HANDLERS and invokes each handler
     * with the provided context object.
     *
     * If any handler returns true, the event is considered consumed
     * and normal processing must stop.
     *
     * If no handler consumes the event, returns false.
     *
     *
     * INPUT
     * -----
     * @param {Object} ctx
     *   Context object passed through from setupEventHandler().
     *   Typically includes:
     *     el           matched ActiveTags root element
     *     e            DOM event object
     *     eventType    normalized event type
     *     subSelector  optional trigger selector
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if a special handler consumed the event
     *   false if normal processing should continue
     *
     *
     * SIDE EFFECTS
     * ------------
     * Depends on the behavior of registered special handlers.
     * This method itself does not enqueue pipelines or install handlers.
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * SPECIAL_EVENT_HANDLERS must be pure routing filters.
     * They must return true only when they have fully handled the event.
     * They must not mutate controller state.
     */
    _handleSpecialEvent(ctx) {
	for (const fn of SPECIAL_EVENT_HANDLERS) {
            if (fn(ctx)) return true;
	}
	return false;
    }
    
    
    /**
     * Uninstall delegated event handlers for registered event bindings.
     *
     * CONTRACT
     * --------
     * off() uninstalls delegated handlers previously installed by on().
     *
     * It does not execute pipelines.
     * It does not enqueue pipelines.
     * It does not modify enable state.
     *
     * Calling off() is safe even if the targeted binding is not installed.
     * Bindings that are not installed result in no action and contribute 0 to the count.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, off() applies globally to all Jobs in the registry.
     *
     * @param {string} [eventName]
     *   Optional event binding name selector.
     *   If provided and non-empty, only that binding name is targeted.
     *   If omitted or empty, all bindings for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to uninstall bindings for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its event map from the registry.
     *
     * Binding selection
     *   If eventName is provided, attempts to uninstall that single binding.
     *   Otherwise attempts to uninstall all registered bindings for the Job.
     *
     * Uninstallation is delegated to the internal _offOne(job, name) helper.
     * _offOne is responsible for invoking the uninstall function and updating state.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of delegated handlers successfully uninstalled.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May uninstall delegated handlers through the injected delegator service.
     * May update registry runtime state for uninstalled bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove event definitions from the registry.
     * Does not change enable state.
     * Does not validate pipeline existence.
     */
    off(jobLike, eventName) {
        const lib = this.lib;

        // global off(): uninstall everything currently installed
        if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
                const job = this.toJob(jobId);
                if (!job || !job.id) continue;
                count += this.off(job);
            }
            return count;
        }

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        if (lib.str.to(eventName, true).trim()) {
            return this._offOne(job, eventName);
        }

        let count = 0;
        for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
        }
        return count;
    }

    /**
     * Developer note
     * --------------
     * _offOne() is the internal uninstallation primitive for a single event binding.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use off(), disable(), or remove().
     *
     *
     * CONTRACT
     * --------
     * _offOne() attempts to uninstall exactly one delegated handler for a Job and
     * event binding name.
     *
     * It enforces all uninstallation gates:
     *   Job must resolve and have an id
     *   eventName must be a non-empty string
     *   event entry must exist in the registry
     *   entry.on must be true
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * TEARDOWN STRATEGY
     * -----------------
     * Teardown uses two mechanisms for safety:
     *
     * 1. Direct unsubscribe
     *    If entry.offFn is present, it is invoked to uninstall the handler.
     *
     * 2. Tag-based teardown
     *    If entry.runtimeTag is present, delegator.offTag(tag) is invoked as a
     *    defensive cleanup mechanism.
     *
     * Both may be used to tolerate partial state or delegator implementation changes.
     *
     *
     * DELEGATOR CONTRACT
     * ------------------
     * This method assumes the injected delegator service provides:
     *   offTag(tag)
     *
     * entry.offFn is expected to be the uninstall function returned by delegator.on().
     *
     *
     * SIDE EFFECTS
     * ------------
     * Uninstalls the delegated handler through the delegator service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to false
     *   entry.runtimeTag is cleared
     *   entry.offFn is cleared
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not alter enable state.
     * This method must not remove registry entries.
     * This method must not enqueue or execute pipelines.
     */
    _offOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // already off
        if (lib.bool.no(entry.on)) return 0;

        // teardown using the stored unsubscribe if present; also tag-teardown for safety
        if (typeof entry.offFn === "function") entry.offFn();
        if (entry.runtimeTag) this.delegator.offTag(entry.runtimeTag);

        entry.on = false;
        entry.runtimeTag = null;
        entry.offFn = null;

        return 1;
    }
}

export default Controller;
