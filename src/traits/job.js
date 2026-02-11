/**
 * Job Resolution Trait
 * --------------------
 *
 * This trait provides a minimal, stable abstraction for resolving
 * references into registered `Job` instances.
 *
 * It acts as a thin convenience layer over the job registry and is
 * intentionally small. Additional job-related surface area may be added
 * here in the future.
 *
 * RESPONSIBILITIES:
 * - Resolve job references into concrete `Job` instances
 * - Delegate resolution logic to the runtime job registry
 *
 * NON-RESPONSIBILITIES:
 * - Does NOT create jobs
 * - Does NOT register jobs
 * - Does NOT execute, schedule, or mutate jobs
 * - Does NOT validate job state or configuration
 *
 * DESIGN NOTES:
 * - This trait exists to avoid leaking registry internals to callers
 * - Resolution semantics are owned by the job registry (`this.jobs`)
 * - Callers should treat returned jobs as opaque runtime objects
 *
 * Typical usage:
 * - Resolve a job by id
 * - Resolve a job by DOM element
 * - Resolve a job-like reference passed through APIs
 */
export const trait_job = {

    /**
     * Resolve a job reference into a registered `Job` instance.
     *
     * Resolution semantics are delegated to the job registry.
     * The registry may support resolution by:
     * - Job id (string)
     * - DOM element
     * - Job-like object
     *
     * @param {*} ref
     *   Job reference to resolve.
     *   The accepted types depend on the registry implementation.
     *
     * @returns {Job|undefined}
     *   The resolved `Job` instance if found, otherwise `undefined`.
     *
     * @notes
     * - This method is side-effect free.
     * - Returning `undefined` indicates the reference could not be resolved.
     */
    toJob(ref) {
        return this.jobs.resolve(ref) || undefined;
    }
};

export default trait_job;
