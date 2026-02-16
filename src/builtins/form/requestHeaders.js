// builtins/form/requestHeaders.js
// Builtin op path: `form.headers`
// Detail op label used in status payload: `request.headers`
/**
 * Attach HTTP request headers to the current buffer context.
 *
 * This builtin annotates the ticket buffer with request-scoped headers
 * to be consumed later by transport stages (e.g. `form.submit`, `http.send`).
 *
 * Headers are stored on `buffer.meta().headers` and do not affect the
 * buffer value itself. This keeps payload data and transport metadata
 * cleanly separated.
 *
 * Supported argument shapes:
 * - `{ "X-CSRF": "abc", "Authorization": "Bearer token" }`
 * - `{ headers: { ... } }`
 * - `{ mode: "merge" | "replace" | "clear", headers: { ... } }`
 *
 * Modes:
 * - `"merge"`   (default): shallow-merge headers into existing set
 * - `"replace"`: replace all existing headers
 * - `"clear"`  : remove all headers
 *
 * This stage performs no network activity and does not validate header
 * values. It exists purely to stage request metadata for downstream
 * transport operations.
 *
 * Failure semantics:
 * - Throws on invalid arguments or buffer access errors.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Object|null} params.args  Header definitions and options
 * @param {Object} params.buffer     Ticket buffer (conveyor slot)
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after headers are staged on the buffer,
 *   or `{ status: "error" }` if header mutation fails.
 */

export default async function requestHeaders({ lib, args, buffer, step } = {}) {
    try {
        const a = lib.hash.is(args) ? args : {};
    // args is user-supplied; normalize lightly using your tools
    // Supported shapes:
    //  - { "X-CSRF": "abc" }
    //  - { headers: { ... } }
    //  - { mode: "replace"|"merge"|"clear", headers: { ... } }

        const mode = a.mode || "merge";
        const h = lib.hash.is(a.headers) ? a.headers : a;

        const meta = buffer.meta();
        meta.headers = lib.hash.is(meta.headers) ? meta.headers : {};

        if (mode === "clear") {
            meta.headers = {};
        } else if (mode === "replace") {
            meta.headers = h;           // no coercion
        } else {
            Object.assign(meta.headers, h);
        }

        return { status: "ok", detail: { op: "request.headers", step, mode } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "request.headers", step } };
    }
}
