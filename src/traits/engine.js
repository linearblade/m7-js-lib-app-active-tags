/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

export const trait_engine = {

    /**
     * Enqueue autorun pipelines for all currently registered jobs.
     *
     * CONTRACT
     * --------
     * `enqueueAll()` performs a one-time sweep over the JobRegistry and
     * requests enqueue of pipelines explicitly marked for autorun.
     *
     * It does not execute pipelines directly.
     * It does not mutate job configuration.
     * It does not manage scheduling or retries.
     *
     *
     * ELIGIBILITY RULES
     * -----------------
     * For each registered job:
     * - `job.config.schema.enabled` must not be `false`.
     * - `job.config.schema.autorun` must be a non-empty list.
     *
     * Jobs that do not satisfy both conditions are skipped.
     *
     *
     * AUTORUN SEMANTICS
     * -----------------
     * `job.config.schema.autorun` is treated as a list of pipeline keys.
     * Each key is enqueued independently.
     * The special token `"__DEFAULT__"` is normalized to `"default"`.
     *
     *
     * ENQUEUE PAYLOAD
     * ---------------
     * For each eligible key:
     * `engine.enqueue(job, pipelineKey, { inputs: { reason }, meta: { source: "enqueueAll" } })`
     *
     *
     * @param {string|Object} [opts]
     * Optional enqueue-all options.
     *
     * Coercion semantics:
     * - Non-hash input is coerced via `lib.hash.to(opts, "reason")`
     * - Example: `enqueueAll("boot")` becomes `{ reason: "boot" }`
     *
     * Object form:
     * - opts.reason (string): diagnostic reason label (defaults to `"none given"`)
     * - opts.returnMeta (boolean): when true, returns enqueue metadata entries
     * - opts.internal (boolean-ish): when true, includes internal synthetic jobs
     * - opts.rerun (boolean-ish): when true, includes jobs whose
     *   `flags.hasRun === true`
     *
     * Notes:
     * - `returnMeta`, `internal`, and `rerun` are only configurable through object input.
     * - By default, jobs with `flags.hasRun === true` are skipped.
     *
     * @returns {number|{count: number, entries: Array}}
     * - Default: number of enqueue attempts issued.
     * - With `returnMeta`: `{ count, entries }` where each entry includes
     *   `{ jobId, pipelineKey, ticket, created }`.
     */

    enqueueAll(opts) {
	const lib = this.lib;
	const jobs = this.jobs.list();
	opts = lib.hash.to(opts, "reason");
	opts.internal = lib.bool.yes(opts.internal);
	opts.rerun = lib.bool.yes(opts.rerun);
	const reason = lib.str.to(opts.reason, true).trim() ?
	      lib.str.to(opts.reason, true).trim() :
              "none given";
	const returnMeta = !!opts.returnMeta;
	const entries = returnMeta ? [] : null;

	let count = 0;
	for (const job of jobs) {
            const isInternal = lib.bool.yes(lib.hash.get(job, "flags.internal"));
            if (isInternal && !opts.internal) continue;
            const hasRun = lib.bool.yes(lib.hash.get(job, "flags.hasRun"));
            if (hasRun && !opts.rerun) continue;
            // enabled gate
            const enabled = lib.hash.get(job, "config.schema.enabled");
            if (enabled === false) continue;
	    //console.log('JOB: ' + job.name );
            // autorun list
            let autorun = lib.hash.get(job, "config.schema.autorun");
	    //console.log(enabled,autorun, job.name,job.id);
            if (!lib.array.len(autorun)) continue;
	    //console.log(autorun);
            for (let key of autorun) {
		//console.log(' -- '+key);
		if (!key) continue;
		
		// "__DEFAULT__" -> "default"
		if (key === "__DEFAULT__") key = "default";
		count++;
		const r = this.engine.enqueue(job, key, {
                    inputs: { reason },
                    meta: { source: "enqueueAll" },
		    returnMeta,
		});
		//console.log(r);
		if (returnMeta) {
		    entries.push({
			jobId: job.id,
			pipelineKey: key,
			ticket: r && r.ticket ? r.ticket : null,
			created: !!(r && r.created),
		    });
		}
            }
	}
	return returnMeta ? { count, entries } : count;
    }
};

export default trait_engine;
