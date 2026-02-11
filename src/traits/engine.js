export const trait_engine = {

    /**
 * Enqueue autorun pipelines for all registered Jobs.
 *
 * CONTRACT
 * --------
 * enqueueAll() performs a one-time sweep over the JobRegistry and
 * enqueues pipelines explicitly marked for autorun.
 *
 * It does not execute pipelines directly.
 * It does not validate pipeline existence.
 * It does not mutate job configuration.
 * It does not manage scheduling or retries.
 *
 *
 * ELIGIBILITY RULES
 * -----------------
 * For each registered Job:
 *
 *   job.config.schema.enabled must be true.
 *   job.config.schema.autorun must be a non-empty array.
 *
 * Jobs that do not satisfy both conditions are skipped.
 *
 *
 * AUTORUN SEMANTICS
 * -----------------
 * job.config.schema.autorun is expected to be an array of pipeline keys.
 *
 * Each pipeline key is enqueued independently.
 *
 * The special token "__DEFAULT__" is normalized to "default".
 *
 *
 * ENQUEUE BEHAVIOR
 * ----------------
 * For each eligible pipeline:
 *
 *   engine.enqueue(job, pipelineKey, context)
 *
 * Context includes:
 *   inputs.reason   the provided reason string
 *   meta.source     "enqueueAll"
 *
 *
 * INPUT
 * -----
 * @param {string} [reason]
 *   Optional string describing why autorun is occurring.
 *   Examples include "boot" or "reload".
 *   If missing or invalid, defaults to "none given".
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {number}
 *   The number of pipelines successfully enqueued.
 *
 *
 * DESIGN NOTES
 * ------------
 * This is a public runtime convenience method.
 * It exists to allow manual triggering of autorun pipelines
 * without requiring direct interaction with the Engine.
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
