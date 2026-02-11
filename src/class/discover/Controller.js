// class/discover/Controller.js

import Job from '../job/Job.js';
import CONSTANTS from '../../constants.js';
import configReporter from '../../helpers/reporter/configReporter.js';

/**
 * Discover Controller
 * ===================
 *
 * Subsystem role
 * --------------
 * The Discover Controller is the DOM to JobRegistry bridge of ActiveTags.
 *
 * Responsibilities
 * ---------------
 * It scans the DOM for candidate elements, instantiates Job objects for eligible
 * elements, registers Jobs into the runtime JobRegistry, performs initial safe
 * job configuration, and emits configuration diagnostics.
 *
 * Non-responsibilities
 * --------------------
 * It does not execute jobs, schedule jobs, manage pipelines, run the engine,
 * manage intervals or events, or mutate the DOM.
 *
 * Architectural position
 * ----------------------
 * This controller operates strictly at the boundary:
 *
 * DOM -> Job instances -> JobRegistry
 *
 * It is deterministic, idempotent per DOM element, side-effect limited to
 * registration, and free of execution semantics. Execution is handled by the
 * Engine layer.
 *
 * Public surface
 * --------------
 * scan(sel?, opts?) -> Promise<Job[]>
 *   Perform DOM scan and job registration.
 *
 * registerJobs(list, opts?) -> Promise<Job[]>
 *   Instantiate and register jobs for a provided element list.
 *
 * sweep(sel?) -> Element[]
 *   Pure DOM discovery with no side effects.
 *
 * Lifecycle model
 * ---------------
 * This controller is not stateful in the runtime sense. It does not implement
 * on/off/start/stop semantics because it is not a signal source, it does not
 * bind listeners, and it does not maintain runtime attachments.
 *
 * It is an orchestration tool intended to run at boot, on demand, or from
 * MutationObserver callbacks.
 *
 * Idempotency guarantee
 * ---------------------
 * Job identity is bound to DOM elements.
 *
 * If an element is already associated with a Job, scan() will not create a
 * duplicate. registerJobs() will return existing Jobs unless
 * opts.ignoreExisting is true.
 *
 * Configuration flow
 * ------------------
 * For newly created Jobs:
 *
 * 1. Base job configuration is taken from AT.conf.job.config
 * 2. Runtime overrides (evalEnabled, importEnabled, etc.) may be supplied via opts
 * 3. Job.configure() is invoked exactly once at creation
 * 4. Configuration diagnostics are emitted via configReporter()
 *
 * Failure modes
 * -------------
 * This controller will throw if AT.conf.env.document is missing or invalid, or
 * if required dependencies (AT, lib, JobRegistry) are missing.
 *
 * It will silently skip non-DOM values, invalid selectors, duplicate elements,
 * and empty selector inputs.
 *
 * Design constraints
 * ------------------
 * It must remain execution-agnostic, must not leak engine semantics, must not
 * mutate runtime job state beyond registration, and must remain safe to call
 * repeatedly.
 *
 * Future extensions
 * -----------------
 * Possible additions that fit this subsystem include reconcile() for full DOM
 * reconciliation, explicit detachment helpers, and subtree scan helpers. Any
 * feature involving execution or scheduling does not belong here.
 */

export class Controller {

    /**
     * Create a new Discover Controller.
     *
     * CONTRACT
     * --------
     * The Discover Controller requires a fully initialized ActiveTags instance.
     * It must be constructed only after the following are available on AT:
     *   AT.jobs (JobRegistry)
     *   AT.conf (compiled configuration)
     *   AT.expr (ExpressionResolver)
     *
     * Construction performs validation and reference caching only.
     * No DOM scanning, job creation, or execution logic occurs here.
     *
     *
     * REQUIRED DEPENDENCIES
     * ---------------------
     * @param {Object} opts
     *
     * @param {ActiveTags} opts.AT
     *   The owning ActiveTags instance.
     *   Must expose:
     *     jobs   JobRegistry
     *     conf   compiled configuration
     *     expr   ExpressionResolver
     *     svc    service map
     *
     * @param {Object} opts.lib
     *   The m7 lib instance.
     *   Used for DOM inspection, normalization, and configuration merging.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Caches stable references to AT, lib, jobs, expr, conf, and svc.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     * Throws if AT.jobs is not present.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform DOM scans.
     * Does not create or configure Jobs.
     * Does not execute or schedule pipelines.
     *
     * Those responsibilities are handled by scan(), registerJobs(), and sweep().
     */
    constructor({ AT, lib, toJob } = {}) {
        if (!AT) throw new Error("discover/Controller requires AT");
        if (!lib) throw new Error("discover/Controller requires lib");
        if (typeof toJob !== "function")
            throw new Error("discover/Controller requires toJob(x) function");

        if (!AT.jobs)
            throw new Error("discover/Controller requires AT.jobs (JobRegistry)");

        this.AT     = AT;
        this.lib    = lib;
        this.toJob  = toJob;

        this.jobs   = AT.jobs;
        this.expr   = AT.expr;
        this.conf   = AT.conf;
        this.svc    = AT.svc;

        Object.freeze(this);
    }

    /**
     * Scan the DOM and register Jobs for discovered elements.
     *
     * CONTRACT
     * --------
     * scan() is the primary public entry point of the Discover Controller.
     * It performs DOM candidate discovery followed by Job instantiation
     * and registration.
     *
     * It does not execute Jobs.
     * It does not schedule pipelines.
     * It does not mutate the DOM.
     *
     * This method is safe to call repeatedly.
     *
     *
     * INPUT
     * -----
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *   Selector string, DOM element, or array of selectors and or elements.
     *   If null or undefined, defaults to AT.conf.boot.selector.
     *
     * @param {Object} [opts={}]
     *   Optional registration behavior overrides.
     *   Supported keys include:
     *     ignoreExisting
     *     evalEnabled
     *     evalType
     *     importEnabled
     *     importPath
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls sweep(sel) to obtain a de-duplicated list of candidate elements.
     * 2. If no candidates are found, returns an empty array.
     * 3. Calls registerJobs(list, opts) to instantiate and register Jobs.
     * 4. Returns the array of registered Job instances.
     *
     *
     * IDEMPOTENCY
     * -----------
     * If an element is already associated with a Job, no duplicate Job is created.
     * Existing Jobs are returned unless opts.ignoreExisting is true.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job[]>}
     *   Resolves to an array of Job instances that are now registered.
     *   May be empty if no candidates were found.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if sweep() fails due to missing or invalid configuration.
     * Propagates any errors thrown by registerJobs().
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create and register new Job instances.
     * May configure newly created Jobs.
     * May emit configuration diagnostics.
     */
    async scan(sel = null, opts = {}) {
        const list = this.sweep(sel);
        if (!this.lib.array.len(list)) return [];
        return this.registerJobs(list, opts);
    }

    /**
     * Instantiate and register Jobs for a list of DOM elements.
     *
     * CONTRACT
     * --------
     * registerJobs() converts DOM elements into persistent Job instances
     * and registers them into the JobRegistry.
     *
     * It does not execute Jobs.
     * It does not schedule pipelines.
     * It does not mutate the DOM.
     *
     * This method is safe to call repeatedly.
     *
     *
     * INPUT
     * -----
     * @param {Array<Element>|ArrayLike<Element>} list
     *   Collection of DOM elements to process.
     *   Non-DOM values are ignored.
     *
     * @param {Object} [opts={}]
     *   Optional registration overrides.
     *
     *   Supported keys include:
     *     ignoreExisting
     *     evalEnabled
     *     evalType
     *     importEnabled
     *     importPath
     *
     *
     * BEHAVIOR
     * --------
     * 1. Normalizes input list into an array.
     * 2. Skips values that are not valid DOM elements.
     * 3. For each element:
     *      If a Job already exists for the element:
     *          Returns the existing Job unless ignoreExisting is true.
     *      If no Job exists:
     *          Creates a new Job instance.
     *          Registers the Job with the JobRegistry.
     *          Merges base job configuration with runtime overrides.
     *          Invokes Job.configure() exactly once.
     *          Emits configuration diagnostics.
     *          Sets the Job name in the registry.
     *
     *
     * IDEMPOTENCY
     * -----------
     * Job identity is bound to DOM elements.
     * No duplicate Job will be created for the same element.
     *
     *
     * CONFIGURATION RULES
     * -------------------
     * Base configuration is taken from AT.conf.job.config.
     * Runtime overrides are limited to eval and import related keys.
     * Merge semantics follow CONSTANTS.MERGE_OPTS_V1.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job[]>}
     *   Resolves to an array of Job instances that are now registered.
     *   The array may include existing Jobs unless ignoreExisting is true.
     *
     *
     * FAILURE MODES
     * -------------
     * Propagates errors thrown by:
     *   Job constructor
     *   JobRegistry.register()
     *   Job.configure()
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create and register new Job instances.
     * May configure newly created Jobs.
     * May emit configuration diagnostics.
     * May update registry name mappings.
     */
    async registerJobs(list, opts = {}) {
        const { lib } = this;
        const jobs = [];

        opts = lib.hash.to(opts, 'ignoreExisting');
        list = lib.array.to(list);

        const ignoreExisting = lib.bool.yes(opts.ignoreExisting);

        for (let i = 0; i < list.length; i++) {
            const tag = list[i];
            if (!lib.dom.is(tag)) continue;

            const existing = this.jobs.getByElement(tag);
            if (existing) {
                if (!ignoreExisting) jobs.push(existing);
                continue;
            }

            const job = new Job({
                lib,
                expr: this.expr,
                e: tag,
                ws: {},
                conf: this.conf.job,
                env: this.conf.env
            });

            const registered = this.jobs.register(job);
            jobs.push(registered);

            // ---- configuration phase ----
            const def     = this.conf.job.config;
            const runOpts = lib.hash.slice(
                opts,
                "evalEnabled evalType importEnabled importPath"
            );

            const jobConf = lib.hash.merge(
                def,
                runOpts,
                CONSTANTS.MERGE_OPTS_V1
            );

            await registered.configure(jobConf);

            // ---- diagnostics ----
            configReporter({
                lib,
                job: registered,
                log: this.svc.log,
                bucketName:
                this.conf.log.buckets[CONSTANTS.LOG_BUCKETS.CONFIG]
            });

            this.jobs.setName(registered, registered.name);
        }

        return jobs;
    }


    /**
     * Discover candidate DOM elements for Job registration.
     *
     * CONTRACT
     * --------
     * sweep() performs pure DOM discovery.
     * It does not create Jobs.
     * It does not register Jobs.
     * It does not execute or schedule pipelines.
     * It does not mutate runtime state.
     *
     * This method is deterministic and side-effect free.
     *
     *
     * INPUT
     * -----
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *   Selector string, DOM element, or array of selectors and or elements.
     *   If null or undefined, defaults to AT.conf.boot.selector.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Validates that a usable document exists in AT.conf.env.
     * 2. Normalizes input into an array of targets.
     * 3. For each target:
     *      If it is a DOM element, it is added directly.
     *      Otherwise it is treated as a selector and queried via document.querySelectorAll.
     * 4. De-duplicates results using object identity.
     * 5. Returns the resulting array of DOM elements.
     *
     *
     * OUTPUT GUARANTEE
     * ----------------
     * @returns {Element[]}
     *   A de-duplicated array of DOM elements.
     *   May be empty if no matches are found.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT.conf.env is missing.
     * Throws if AT.conf.env.document is missing or does not support querySelectorAll.
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * sweep() must remain:
     *   Pure with respect to runtime state.
     *   Independent of JobRegistry.
     *   Independent of execution semantics.
     *   Safe to call repeatedly on the same input.
     */
    sweep(sel = null) {
        const { lib } = this;
        const env = this.conf.env;

        if (!env)
            throw new Error("discover/Controller.sweep(): missing conf.env");

        const { document } = env;
        if (!document || typeof document.querySelectorAll !== "function") {
            throw new Error(
                "discover/Controller.sweep(): invalid or missing document"
            );
        }

        const input = sel ?? this.conf.boot.selector;

        const targets = lib.dom.is(input)
              ? [input]
              : lib.array.to(input);

        const out = [];
        const seen = new Set();

        const push = (node) => {
            if (!node || !lib.dom.is(node) || seen.has(node)) return;
            seen.add(node);
            out.push(node);
        };

        for (const t of targets) {
            if (lib.dom.is(t)) {
                push(t);
                continue;
            }

            const selector = String(t ?? "").trim();
            if (!selector) continue;

            const nodes = document.querySelectorAll(selector);
            for (const n of nodes) push(n);
        }

        return out;
    }
}

export default Controller;
