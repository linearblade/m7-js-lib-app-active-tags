/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Runtime Controller
 * ------------------
 *
 * Aggregates top-level runtime subsystem references for ActiveTags.
 *
 * This controller is intentionally lightweight in v1:
 * - validates constructor dependencies
 * - snapshots subsystem references
 * - provides a stable home for future runtime orchestration methods
 *
 * It does not execute pipelines directly.
 * It does not mutate Job configuration.
 */

import Job from '../job/Job.js';

export class Controller {
    /**
     * @param {Object} [opts]
     * @param {Object} opts.AT
     * @param {Object} opts.lib
     */
    constructor({ AT, lib } = {}) {
	if (!AT) throw new Error("RuntimeController requires { AT }");
	if (!lib) throw new Error("RuntimeController requires { lib }");

	this.AT = AT;
	this.lib = lib;

	// runtime subsystem refs (non-owning)
	this.jobs = AT.jobs || null;
	this.engine = AT.engine || null;
	this.discover = AT.discover || null;
	this.observer = AT.observer || null;
	this.intervals = AT.intervals || null;
	this.events = AT.events || null;

	Object.freeze(this);
    }

    /**
     * Normalize a stable identifier for synthetic runtime jobs/pipelines.
     *
     * @param {*} name
     * @returns {string}
     */
    _internalIdentifier(name) {
	const raw = this.lib.str.to(name, true).trim();
	if (!raw) return "";
	return raw.replace(/[^A-Za-z0-9_-]+/g, "_");
    }

    /**
     * Internal-job creation wrapper over createJob().
     *
     * @param {*} name
     *   Required internal key source. Must resolve to a non-empty identifier.
     * @param {Object} [def]
     * @param {Object} [opts]
     * @param {string} [opts.domain="runtime"]
     * @param {Element} [opts.e]
     * @param {Element} [e]
     * @returns {Promise<{ job: Object, identifier: string, created: boolean }>}
     */
    async createInternalJob(name, def = {}, opts = {}, e = undefined) {
	const lib = this.lib;

	const rec = lib.hash.to(def);
	opts = lib.hash.to(opts);

	const identifier = this._internalIdentifier(name);
	if (!identifier) {
	    throw new Error("[RuntimeController] createInternalJob() requires non-empty name");
	}

	const domainRaw = lib.str.to(lib.hash.get(opts, "domain"), true).trim().toLowerCase();
	const domain = domainRaw || "runtime";
	const internalElement = e || lib.hash.get(opts, "e");
	const syntheticName = `__internal_${domain}_${identifier}`;

	const result = await this.createJob({
	    name: syntheticName,
	    def: rec,
	    opts: Object.assign({}, opts, {
		e: internalElement,
		indexElement: false,
		returnExisting: true,
		enforceNameUnique: true,
		configure: "from",
	    }),
	    e: internalElement,
	    headless: false,
	});

	if (result && result.job && result.job.flags && typeof result.job.flags === "object") {
	    result.job.flags.internal = true;
	}

	return { job: result.job, identifier, created: !!result.created };
    }

    /**
     * Unified runtime job creation path.
     *
     * This method centralizes runtime-oriented Job construction, registration,
     * and initial configuration.
     *
     * @param {Object} [args]
     * @param {*} args.name
     *   Runtime job name. If empty, falls back to `def.name`.
     * @param {Object} [args.def]
     *   Config object compiled into the job via configure mode.
     * @param {Object} [args.opts]
     *   Creation/configuration options.
     * @param {Element|null} [args.e]
     *   Explicit element anchor. Takes precedence over `opts.e`.
     * @param {boolean} [args.headless=false]
     *   Headless intent flag. When true, element anchor is forced to null.
     *   During VM stage execution, effective `e`/`job.e` falls back to
     *   `AT.conf.env.document.body` when no element is bound.
     * @param {Element|null} [args.opts.e]
     *   Fallback element anchor when `args.e` is not provided.
     * @param {boolean} [args.opts.indexElement]
     *   Controls registry element indexing.
     *   Default:
     *   - `false` when `headless` is true (forced; no override path)
     *   - `!!resolvedElement` otherwise
     * @param {boolean} [args.opts.returnExisting=true]
     *   When true, registration may reuse an existing job.
     * @param {boolean} [args.opts.enforceNameUnique=true]
     *   When true and a non-empty runtime name is available, existing jobs are
     *   resolved by name before registration. Ambiguous name matches throw.
     *   This defaults to true and is recommended for synthetic/headless jobs.
     * @param {"from"|"dom"} [args.opts.configure="from"]
     *   Initial config path:
     *   - `"from"` => `job.configureFrom(def)`
     *   - `"dom"`  => `job.configure(def)`
     *   Forced to `"from"` when `headless` is true.
     * @returns {Promise<{ job: Object, created: boolean, headless: boolean }>}
     */
    async createJob({
	name,
	def = {},
	opts = {},
	e = undefined,
	headless = false,
    } = {}) {
	const lib = this.lib;
	const AT = this.AT;

	const rec = lib.hash.to(def);
	opts = lib.hash.to(opts);
	const explicitName = lib.str.to(name, true).trim()
	      || lib.str.to(lib.hash.get(rec, "name"), true).trim();
	if (!lib.utils.isEmpty(explicitName)) rec.name = explicitName;

	const explicitElement = e || lib.hash.get(opts, "e");
	const isHeadless = lib.bool.yes(headless);
	const jobElement = isHeadless ? null : explicitElement;

	const hasIndexElementOpt = Object.prototype.hasOwnProperty.call(opts, "indexElement");
	const indexElement = isHeadless
	      ? false
	      : (hasIndexElementOpt ? !lib.bool.no(opts.indexElement) : !!jobElement);

	const hasReturnExistingOpt = Object.prototype.hasOwnProperty.call(opts, "returnExisting");
	const returnExisting = hasReturnExistingOpt
	      ? lib.bool.yes(opts.returnExisting)
	      : true;

	const hasEnforceNameUniqueOpt = Object.prototype.hasOwnProperty.call(opts, "enforceNameUnique");
	const enforceNameUnique = hasEnforceNameUniqueOpt
	      ? !lib.bool.no(opts.enforceNameUnique)
	      : true;

	let byName = null;
	if (enforceNameUnique && !lib.utils.isEmpty(explicitName)) {
	    const matches = AT.jobs.listByName(explicitName);
	    if (matches.length > 1) {
		throw new Error(`[RuntimeController] createJob(): enforceNameUnique collision (name="${explicitName}")`);
	    }
	    byName = matches.length ? matches[0] : null;
	}

	const candidate = byName || new Job({
	    lib,
	    expr: AT.expr,
	    headless: isHeadless,
	    e: jobElement,
	    ws: {},
	    conf: AT.conf.job,
	    env: AT.conf.env,
	    name: explicitName || null,
	});

	const job = byName || AT.jobs.register(candidate, { indexElement, returnExisting });
	const created = !byName && (job === candidate);

	const configureMode = isHeadless
	      ? "from"
	      : (lib.str.to(lib.hash.get(opts, "configure"), true).trim().toLowerCase() || "from");
	if (configureMode === "dom") await job.configure(rec);
	else await job.configureFrom(rec);
	AT.jobs.setName(job, job.name);

	return {
	    job,
	    created,
	    headless: isHeadless,
	};
    }

    /**
     * Headless runtime-job convenience wrapper.
     *
     * @param {*} name
     * @param {Object} [def]
     * @param {Object} [opts]
     * @returns {Promise<{ job: Object, created: boolean, headless: boolean }>}
     */
    async createHeadlessJob(name, def = {}, opts = {}) {
	return this.createJob({
	    name,
	    def,
	    opts: Object.assign({}, this.lib.hash.to(opts), {
		returnExisting: true,
		configure: "from",
	    }),
	    e: null,
	    headless: true,
	});
    }

    /**
     * Attach newly observed DOM nodes to runtime controllers.
     *
     * The observer may report nodes repeatedly across mutation batches, so this
     * method first filters to truly fresh elements that are not already present
     * in the Job registry.
     *
     * Attach order is:
     * 1. Register new Jobs from the provided DOM nodes
     * 2. Register event and interval definitions for each new enabled Job
     * 3. Conditionally turn on events and intervals according to boot policy
     * 4. Autorun newly eligible Jobs
     *
     * @param {Array|ArrayLike} nodes
     * @param {Object} [opts]
     * @param {string} [opts.reason="observer"]
     * @returns {Promise<{jobs: Array, count: number}>}
     */
    async attachObservedNodes(nodes = [], { reason = "observer" } = {}) {
	const lib = this.lib;
	const fresh = [];
	const seen = new Set();
	const observeConf = lib.hash.to(this.AT.conf.observe);
	const shouldSyncRuntime = !lib.bool.no(observeConf.runtimeAttach);

	for (const node of lib.array.to(nodes)) {
	    if (!node || seen.has(node)) continue;
	    seen.add(node);

	    if (this.jobs && typeof this.jobs.hasElement === "function" && this.jobs.hasElement(node)) {
		continue;
	    }

	    fresh.push(node);
	}

	if (!lib.array.len(fresh)) {
	    return { jobs: [], count: 0 };
	}

	const jobs = await this.discover.registerJobs(fresh);
	let count = 0;

	if (!shouldSyncRuntime) {
	    await this.AT.autorun(reason);
	    return { jobs, count: 0 };
	}

	for (const job of jobs) {
	    if (!job || !job.id) continue;

	    const enabled = lib.hash.get(job, "config.schema.enable.enabled");
	    if (lib.bool.no(enabled)) continue;

	    if (this.events && typeof this.events.register === "function") {
		this.events.register(job);
	    }

	    if (this.intervals && typeof this.intervals.register === "function") {
		this.intervals.register(job);
	    }

	    if (
		!lib.bool.no(this.AT.conf.boot.events) &&
		this.events &&
		typeof this.events.conditionalOn === "function"
	    ) {
		await this.events.conditionalOn(job);
	    }

	    if (
		!lib.bool.no(this.AT.conf.boot.intervals) &&
		this.intervals &&
		typeof this.intervals.conditionalOn === "function"
	    ) {
		await this.intervals.conditionalOn(job);
	    }

	    count++;
	}

	await this.AT.autorun(reason);
	return { jobs, count };
    }

    /**
     * Dispose a runtime Job and its attached controller state.
     *
     * Teardown order is:
     * 1. Remove delegated event handlers + event registry state
     * 2. Remove active intervals + interval registry state
     * 3. Unregister the Job from the central job registry
     *
     * @param {Object|string|Element} jobLike
     * @param {Object} [opts]
     * @param {string} [opts.reason="runtime.dispose"]
     * @returns {boolean}
     */
    disposeJob(jobLike, { reason = "runtime.dispose" } = {}) {
	const lib = this.lib;
	const job = this.AT.toJob(jobLike);
	if (!job || !job.id) return false;
	const observeConf = lib.hash.to(this.AT.conf.observe);

	if (lib.bool.no(observeConf.runtimeDispose)) {
	    this.jobs.unregister(job, { reason });
	    return true;
	}

	if (this.events && typeof this.events.remove === "function") {
	    this.events.remove(job);
	}

	if (this.intervals && typeof this.intervals.remove === "function") {
	    this.intervals.remove(job);
	}

	this.jobs.unregister(job, { reason });
	return true;
    }

    /**
     * Dispose multiple runtime Jobs while deduplicating by job id.
     *
     * @param {Array|ArrayLike} list
     * @param {Object} [opts]
     * @param {string} [opts.reason="runtime.dispose"]
     * @returns {number}
     */
    disposeJobs(list = [], { reason = "runtime.dispose" } = {}) {
	const seen = new Set();
	let count = 0;

	for (const item of this.lib.array.to(list)) {
	    const job = this.AT.toJob(item);
	    if (!job || !job.id || seen.has(job.id)) continue;
	    seen.add(job.id);

	    if (this.disposeJob(job, { reason })) {
		count++;
	    }
	}

	return count;
    }
}

export default Controller;
