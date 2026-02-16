// builtins/httpSend.js
/**
 * `http.send` builtin.
 *
 * Convenience transport stage that delegates to `lib.site.form.submit`
 * and mirrors response payload into `inputs.response`.
 *
 * Source resolution:
 * 1) `trigger`
 * 2) `job.e`
 *
 * Args:
 * - hash args are treated as request overrides
 * - `ajax` is forced to `true`
 *
 * Side effects:
 * - Writes `inputs.response`
 * - Stores a lightweight request record on `job.requests[requestName]`
 *
 * @param {Object} params
 * @param {Object} params.job
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {*} [params.trigger]
 * @param {Object} [params.inputs]
 * @param {*} [params.step]
 *
 * @returns {Promise<Object>}
 *   StageResult-like object (`ok` | `error`).
 */
export default async function httpSend({ job, lib, args, trigger, inputs, step } = {}) {
  try {
    const submit = lib.site.form.submit;

    // Prefer trigger (submitter / event target), fallback to job element
    const source = trigger || job.e;
    lib.dom.attempt(source, true);

    // runtime overrides
    const opts = lib.hash.is(args) ? { ...args } : {};
    opts.ajax = true;

    // send (submit handles collect+encode+request+parse per opts)
    const payload = await submit(source, opts);

    // downstream consumption
    inputs.response = payload;

    // optional request record
    const reqName = opts.name || opts.requestName || "default";
    if (!job.requests) job.requests = {};
    job.requests[reqName] = {
      ts: Date.now(),
      input: inputs.request || null,
      output: payload,
      meta: { op: "http.send" },
    };

    return {
      status: "ok",
      detail: {
        op: "http.send",
        step,
        ok: !!payload?.ok,
        status: payload?.status ?? null,
      },
    };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "http.send", step } };
  }
}
