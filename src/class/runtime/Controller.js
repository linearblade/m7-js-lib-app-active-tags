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
     * Minimal internal job creation path.
     *
     * Constructs a Job, registers it, and configures it.
     * No local runtime tracking or reuse.
     *
     * @param {*} name
     * @param {Object} [def]
     * @param {Object} [opts]
     * @param {string} [opts.domain="runtime"]
     * @param {Element} [opts.e]
     * @param {Element} [e]
     * @returns {Promise<{ job: Object, identifier: string, created: boolean }>}
     */
    async createInternalJob(name, def = {}, opts = {}, e = undefined) {
	const lib = this.lib;
	const AT = this.AT;

	const rec = lib.hash.to(def);
	opts = lib.hash.to(opts);

	const identifier = this._internalIdentifier(name);
	rec.name = identifier;
	const domainRaw = lib.str.to(lib.hash.get(opts, "domain"), true).trim().toLowerCase();
	const domain = domainRaw || "runtime";
	const internalElement = e || lib.hash.get(opts, "e");
	const syntheticName = `__internal_${domain}_${identifier}`;

	const job = AT.jobs.register(
	    new Job({
		lib,
		expr: AT.expr,
		e: internalElement,
		ws: {},
		conf: AT.conf.job,
		env: AT.conf.env,
		name: syntheticName,
	    }),
	    { indexElement: false, returnExisting: true }
	);

	AT.jobs.setName(job, syntheticName);
	await job.configureFrom(rec);

	return { job, identifier, created: true };
    }
}

export default Controller;
