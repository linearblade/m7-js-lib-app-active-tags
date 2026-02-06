//builtins/form/formCollect.js
/**
 * Collect form data from the effective form source and stage it onto the buffer.
 *
 * This builtin invokes `lib.site.form.collect` using the engine trigger (or job
 * element fallback) and replaces the current buffer value with the collected
 * form context.
 *
 * Source resolution order:
 *  1) `trigger` — engine-provided trigger element
 *  2) `job.e`   — the job’s bound element (usually the <form>)
 *
 * The resolved source is asserted to be a valid DOM element. The collection
 * result is expected to include a `form` context; failure to do so is treated
 * as a system error.
 *
 * This stage performs no network activity and does not mutate `inputs`.
 * It exists solely to move form state onto the buffer for downstream stages
 * such as `form.submit` / `http.send`.
 *
 * Failure semantics:
 * - Throws if no valid DOM element can be resolved.
 * - Throws if `lib.site.form.collect` returns an invalid result.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.job        The current job (guaranteed by engine)
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Object|null} params.args  Optional options forwarded to form.collect
 * @param {Object} params.buffer     Ticket buffer (conveyor slot)
 * @param {Element|null} params.trigger
 *                                  Engine-provided trigger element
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after placing collected form data onto the buffer,
 *   or `{ status: "error" }` if form resolution or collection fails.
 */

export default async function formCollect({ job, lib, args, step, trigger, buffer } = {}) {
    try {
        const collect = lib.site.form.collect;

        const source = trigger || job.e;
        lib.dom.attempt(source, true);

        const opts = lib.hash.is(args) ? args : {};
        const data = collect(source, opts);

        if (!data || !data.form) {
            throw new Error("form.collect: collect() returned invalid form context");
        }

        // conveyor: buffer now carries collected form context
        buffer.set(data);

        return {
            status: "ok",
            detail: {
                op: "form.collect",
                step,
                count: lib.array.len(data.parms),
            },
        };
    } catch (err) {
        return {
            status: "error",
            error: err,
            detail: { op: "form.collect", step },
        };
    }
}
