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
     * @param {string} [reason]
     * Optional reason label for telemetry/diagnostics.
     * Defaults to `"none given"` when empty.
     *
     * @returns {number}
     * Number of enqueue attempts issued.
     */

    enqueueAll(reason) {
	const lib = this.lib;
	const jobs = this.jobs.list();

	if (!lib.str.to(reason, true).trim())
            reason = 'none given';

	let count = 0;
	for (const job of jobs) {
            // enabled gate
            const enabled = lib.hash.get(job, "config.schema.enabled");
            if (enabled === false) continue;
	    
            // autorun list
            let autorun = lib.hash.get(job, "config.schema.autorun");
            if (!lib.array.len(autorun)) continue;

            for (let key of autorun) {
		if (!key) continue;

		// "__DEFAULT__" -> "default"
		if (key === "__DEFAULT__") key = "default";
		count++;
		const r = this.engine.enqueue(job, key, {
                    inputs: { reason },
                    meta: { source: "enqueueAll" },
		});
		console.log(r);
            }
	}
	return count;
    }
};

export default trait_engine;
