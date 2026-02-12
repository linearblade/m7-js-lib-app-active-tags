// builtins/form/formSubmit.js
/**
 * @file formSubmit.js
 *
 * ActiveTags builtin: `form.submit`
 *
 * Pipeline-aware wrapper around `lib.site.form.submit` that integrates
 * form submission into the ActiveTags execution model.
 *
 * Responsibilities
 * ----------------
 * - Resolves request options via pipeline metadata (`buffer.meta()`) and runtime args.
 * - Normalizes the submission source (DOM element or prior form.collect output).
 * - Delegates collection, encoding, transport, and response parsing to `lib.site.form.submit`.
 * - Records the request/response pair as a transaction on the job.
 * - Advances the pipeline conveyor by writing the response into the buffer.
 *
 * Design notes
 * ------------
 * - This builtin prefers an existing `form.collect` output if present in the buffer;
 *   otherwise it resolves the submission source from the engine trigger or job element.
 * - The buffer is not implicitly mutated on input; it is only written on successful submission.
 * - Request metadata (headers, mode, etc.) is resolved centrally via `makeOpts`,
 *   with pipeline-staged metadata taking precedence over per-op arguments.
 * - The builtin does not mutate `inputs`; the buffer is the sole data conveyor.
 * - Transaction storage is observational only and does not affect pipeline control flow.
 *
 * Expected buffer states
 * ----------------------
 * - Input: form.collect output (optional)
 * - Output: submission response payload
 *
 * Related helpers
 * ---------------
 * - makeOpts: resolves final request options from buffer meta and args
 * - normalizeTarget: resolves and validates the submission source
 * - storeTransaction: records request/response metadata on the job
 */

export default async function formSubmit({ job, lib, args, trigger, buffer, step } = {}) {
    try {
        const submit = lib.site.form.submit;

        // request metadata (headers etc.)
        const opts = makeOpts({ lib, buffer, args });

        // resolve submission source (DOM element or collect object)
        const { src } = normalizeTarget({ lib, buffer, trigger, job });

        // send (submit handles collect+encode+request+parse per opts)
        const payload = await submit(src, opts);

        // ---- OUTPUT WIRING ----
        const reqName = opts.name || opts.requestName || "default";

        storeTransaction({
            lib,
            job,
            name: reqName,
            request: src,
            response: payload,
            type: "HTTP/1",
            meta: { op: "form.submit" },
        });

        // conveyor: buffer now carries response
        buffer.set(payload);

        return {
            status: "ok",
            detail: {
                op: "form.submit",
                step,
                ok: !!payload?.ok,
                status: payload?.status ?? null,
            },
        };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "form.submit", step } };
    }
}

function makeOpts({ lib, buffer, args } = {}) {
    const staged = buffer.meta() || {};
    const runtime = lib.hash.is(args) ? args : {};

    const rHeaders = lib.hash.is(runtime.headers) ? runtime.headers : {};
    const sHeaders = lib.hash.is(staged.headers) ? staged.headers : null;

    // headers: staged wins over runtime
    const headers = sHeaders
        ? Object.assign({}, rHeaders, sHeaders)
        : (lib.hash.is(runtime.headers) ? runtime.headers : undefined);

    return {
        ajax: true, // ActiveTags default policy
        ...runtime,
        ...staged,
        headers,
    };
}

/**
 * Resolve and validate the submission source.
 *
 * Resolution order:
 * 1) Buffered `form.collect` output (if present)
 * 2) Current trigger element
 * 3) Job root element (`job.e`)
 *
 * @param {Object} deps
 * @param {Object} deps.lib
 * @param {Object} deps.buffer
 * @param {*} deps.trigger
 * @param {Object} deps.job
 * @returns {{src: *, dom: *}}
 */
function normalizeTarget({ lib, buffer, trigger, job } = {}) {
    const isCollect = (x) => x && x.form && Array.isArray(x.parms);

    const buf = buffer.get();
    const src = isCollect(buf)
        ? buf
        : (trigger || job.e);

    const dom = isCollect(src) ? (src.event || src.form) : src;
    lib.dom.attempt(dom, true);

    return { src, dom };
}

/**
 * Persist a lightweight request/response transaction record on the job.
 *
 * @param {Object} deps
 * @param {Object} deps.job
 * @param {string} [deps.name]
 * @param {*} [deps.request]
 * @param {*} [deps.response]
 * @param {*} [deps.meta]
 * @param {string} [deps.type]
 * @returns {Object} Stored transaction record.
 */
function storeTransaction({ lib, job, name, request, response, meta, type } = {}) {
    const txName = name || "default";

    if (!job.transactions) job.transactions = {};

    const tx = {
        ts: Date.now(),
        request: request ?? null,
        response: response ?? null,
        type: type || "HTTP/1",
        meta: meta || null,
    };

    job.transactions[txName] = tx;

    return tx;
}
