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
}

export default Controller;
