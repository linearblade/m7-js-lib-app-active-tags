// builtins/form/formToEnvelope.js
import helpers from "../../class/engine/helpers.js";

function isCollected(x) {
    return !!(x && x.form && Array.isArray(x.parms));
}

function normalizeContentType(lib, v, fallback = "application/x-www-form-urlencoded") {
    const ct = lib.str.to(v, true).trim().toLowerCase();
    if (!ct) return fallback;
    if (ct === "json" || ct === "application/json") return "application/json";
    if (ct === "urlencoded" || ct === "form" || ct === "application/x-www-form-urlencoded") {
        return "application/x-www-form-urlencoded";
    }
    if (ct === "formdata" || ct === "multipart" || ct === "multipart/form-data") {
        return "multipart/form-data";
    }
    return v;
}

/**
 * `form.toEnvelope` builtin.
 *
 * Convert form data into a canonical request envelope and place it in buffer.
 *
 * Flow:
 * - If `buffer.get()` is already `form.collect` output, use it.
 * - Otherwise collect from `trigger` (fallback `job.e`) via `lib.dom.form.collect`.
 * - Build URL/body/headers with `lib.dom.form` helpers.
 * - Build envelope via `lib.request.makeEnvelope`.
 * - Write envelope into buffer.
 *
 * @param {Object} params
 * @param {Object} params.job
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {*} [params.trigger]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`)
 */
export default async function formToEnvelope({ job, lib, args, trigger, buffer, step } = {}) {
    try {
        const a = lib.hash.is(args) ? Object.assign({}, args) : {};

        const jsonRaw = lib.hash.get(a, "json");
        const wantsJson = lib.bool.yes(jsonRaw);
        const blocksJson = lib.bool.no(jsonRaw);

        const structuredRaw = lib.hash.getUntilNotEmpty(a, "structured structure");
        const wantsStructured = lib.bool.yes(structuredRaw);
        const blocksStructured = lib.bool.no(structuredRaw);

        if (wantsJson && !blocksJson && lib.utils.isEmpty(lib.hash.get(a, "contentType"))) {
            a.contentType = "json";
        }
        if (lib.hash.get(a, "structured") === undefined && (wantsStructured || blocksStructured)) {
            a.structured = !blocksStructured;
        }

        const collect = lib.dom.form.collect;
        const formNs = lib.dom.form;

        const fromBuffer = buffer.get();
        const usedBufferCollect = isCollected(fromBuffer);
        let data = fromBuffer;
        if (!isCollected(data)) {
            const source = trigger || job.e;
            lib.dom.attempt(source, true);
            data = collect(source, a);
        }

        if (!isCollected(data)) {
            return helpers.SR_error(new Error("form.toEnvelope: could not derive collected form payload"), {
                op: "form.toEnvelope",
                step,
            });
        }

        const method = lib.str.to(lib.hash.getUntilNotEmpty(a, "method request.method"), true).trim().toUpperCase()
            || lib.str.to(data.method, true).trim().toUpperCase()
            || "POST";

        const contentType = normalizeContentType(
            lib,
            lib.hash.getUntilNotEmpty(a, "contentType request.contentType"),
            "application/x-www-form-urlencoded"
        );

        const useStructured = lib.bool.yes(a.structured);
        const valueAsBody = lib.hash.get(a, "valueAsBody");

        // Keep JSON bodies as objects so callers can inspect/edit envelope.body
        // before @http.send. lib.request will stringify for JSON transport.
        const body = (contentType === "application/json" && !lib.utils.isEmpty(valueAsBody))
            ? formNs.makeBody(data, { method, contentType, structured: useStructured, valueAsBody })
            : (contentType === "application/json")
                ? formNs.toJson(data, { inflate: useStructured })
                : formNs.makeBody(data, {
                    method,
                    contentType,
                    structured: useStructured,
                    valueAsBody,
                });

        const stagedHeaders = lib.hash.to(lib.hash.get(buffer.meta(), "headers"));
        const runtimeHeaders = lib.hash.to(lib.hash.getUntilNotEmpty(a, "headers request.headers", {}));
        const headers = formNs.makeHeader({
            method,
            body,
            contentType,
            headers: Object.assign({}, runtimeHeaders, stagedHeaders),
        });

        const url = formNs.makeUrl(data, {
            method,
            url: lib.hash.getUntilNotEmpty(a, "url request.url"),
        });

        const responseParseRaw = lib.str.to(lib.hash.getUntilNotEmpty(a, "response responseParse request.responseParse"), true).trim();
        const responseParse = responseParseRaw ? responseParseRaw.toLowerCase() : "auto";

        const envelope = lib.request.makeEnvelope({
            transport: lib.str.to(lib.hash.getUntilNotEmpty(a, "transport request.transport"), true).trim().toLowerCase() || "http",
            op: lib.str.to(lib.hash.getUntilNotEmpty(a, "op request.op"), true).trim().toLowerCase() || "send",
            url,
            method,
            headers,
            contentType,
            body,
            responseParse,
            credentials: lib.hash.getUntilNotEmpty(a, "credentials request.credentials"),
            timeoutMs: lib.hash.getUntilNotEmpty(a, "timeoutMs request.timeoutMs"),
        });

        const responseCfg = lib.hash.to(lib.hash.getUntilNotEmpty(a, "responseConfig response request.response"));
        if (!lib.hash.empty(responseCfg)) {
            envelope.response = Object.assign(lib.hash.to(envelope.response), responseCfg);
        }

        buffer.set(envelope);

        return helpers.SR_ok({
            op: "form.toEnvelope",
            step,
            collected: true,
            source: usedBufferCollect ? "buffer" : "collect",
            method,
            url,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "form.toEnvelope", step });
    }
}
