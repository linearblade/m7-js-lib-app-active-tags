/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

// builtins/http/httpSend.js
import helpers from "../../class/engine/helpers.js";

// request merge behavior: array replacement + array/scalar overwrite
const REQUEST_MERGE_OPTS = {
    disp: {
	aa: function (l, r) { return r; },
	as: function (l, r) { return r; }
    }
};

function toQueryString(lib, hash) {
    const rows = [];

    for (const key in hash) {
	if (!Object.prototype.hasOwnProperty.call(hash, key)) continue;
	const value = hash[key];
	if (value === undefined || value === null) continue;

	if (Array.isArray(value)) {
	    for (const v of value) {
		if (v === undefined || v === null) continue;
		rows.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
	    }
	    continue;
	}

	rows.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }

    return rows.join("&");
}

function parseXhrHeaders(xhr) {
    const out = {};
    const raw = (xhr && typeof xhr.getAllResponseHeaders === "function")
	? xhr.getAllResponseHeaders()
	: "";

    if (!raw) return out;

    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
	if (!line) continue;
	const idx = line.indexOf(":");
	if (idx < 1) continue;
	const key = line.slice(0, idx).trim().toLowerCase();
	const value = line.slice(idx + 1).trim();
	out[key] = value;
    }

    return out;
}

function normalizeXhrResponse(xhr, url) {
    return {
	ok: !!(xhr && xhr.status >= 200 && xhr.status < 400),
	status: xhr && typeof xhr.status === "number" ? xhr.status : 0,
	statusText: (xhr && xhr.statusText) ? xhr.statusText : "",
	url: (xhr && xhr.responseURL) ? xhr.responseURL : (url || null),
	headers: parseXhrHeaders(xhr),
	body: (xhr && ("jsonData" in xhr) && xhr.jsonData !== undefined)
	    ? xhr.jsonData
	    : (xhr ? xhr.responseText : undefined),
    };
}

async function normalizeFetchResponse(response) {
    const headers = {};

    if (response && response.headers && typeof response.headers.forEach === "function") {
	response.headers.forEach((v, k) => {
	    headers[String(k).toLowerCase()] = v;
	});
    }

    const text = await response.text();
    const ct = String(headers["content-type"] || "").toLowerCase();
    let body = text;

    if (ct.indexOf("application/json") !== -1 && text) {
	try { body = JSON.parse(text); } catch (err) { /* keep raw text */ }
    }

    return {
	ok: !!response.ok,
	status: response.status,
	statusText: response.statusText,
	url: response.url || null,
	headers,
	body,
	redirected: !!response.redirected,
    };
}

function parseJsonLoose(input) {
    if (typeof input !== "string") return input;
    const text = input.trim();
    if (!text) return input;
    try { return JSON.parse(text); } catch (err) { return input; }
}

function normalizeResponseBody(lib, payload, responseCfg) {
    const mode = lib.str.to(lib.hash.get(responseCfg, "parse"), true).trim().toLowerCase() || "auto";
    const headers = lib.hash.to(payload && payload.headers);
    const ct = lib.str.to(headers["content-type"], true).trim().toLowerCase();
    const body = payload ? payload.body : undefined;

    if (mode === "raw") return body;
    if (mode === "json") return parseJsonLoose(body);
    if (mode === "text") return (body === undefined || body === null) ? "" : lib.str.to(body, true);
    if (mode === "blob") return body;
    if (mode === "arraybuffer") return body;

    // auto
    if (typeof body === "string" && ct.indexOf("application/json") !== -1) {
	return parseJsonLoose(body);
    }
    return body;
}

function pickResponseOutput(lib, payload, responseCfg, normalizedBody) {
    const view = lib.str.to(lib.hash.get(responseCfg, "return"), true).trim().toLowerCase() || "payload";
    let out;

    if (view === "body") out = normalizedBody;
    else if (view === "json") out = parseJsonLoose(normalizedBody);
    else if (view === "text") out = (normalizedBody === undefined || normalizedBody === null) ? "" : lib.str.to(normalizedBody, true);
    else if (view === "headers") out = lib.hash.to(payload && payload.headers);
    else if (view === "status") out = payload ? payload.status : undefined;
    else out = payload;

    const path = lib.str.to(lib.hash.get(responseCfg, "path"), true).trim();
    if (!lib.utils.isEmpty(path)) return lib.hash.get(out, path);
    return out;
}

function normalizeAcceptedStatus(lib, accepted) {
    const scan = lib.array.to(accepted);
    const out = [];
    for (const item of scan) {
	const n = lib.number.toInt(item, NaN);
	if (!Number.isNaN(n)) out.push(n);
    }
    return out;
}

function evaluateResponsePolicy(lib, payload, responseCfg) {
    const status = lib.number.toInt(payload && payload.status, 0);
    const accepted = normalizeAcceptedStatus(lib, lib.hash.get(responseCfg, "acceptedStatus"));
    const requireOk = lib.bool.yes(lib.hash.get(responseCfg, "requireOk"));

    let pass = true;
    let reason = null;

    if (accepted.length > 0 && accepted.indexOf(status) === -1) {
	pass = false;
	reason = "statusNotAccepted";
    } else if (requireOk && !(payload && payload.ok)) {
	pass = false;
	reason = "requireOk";
    }

    return { pass, reason, status, accepted, requireOk };
}

function resolveResponseParseMode(lib, responseCfg) {
    return lib.str.to(lib.hash.get(responseCfg, "parse"), true).trim().toLowerCase();
}

function resolveResponseOutcome({ lib, payload, responseCfg }) {
    const responseParse = resolveResponseParseMode(lib, responseCfg);
    const normalizedBody = normalizeResponseBody(lib, payload, responseCfg);
    const exportValue = pickResponseOutput(lib, payload, responseCfg, normalizedBody);
    const policy = evaluateResponsePolicy(lib, payload, responseCfg);

    const responsePolicyMeta = {
	parse: lib.utils.isEmpty(responseParse) ? "auto" : responseParse,
	return: lib.str.to(lib.hash.get(responseCfg, "return"), true).trim() || "payload",
	path: lib.str.to(lib.hash.get(responseCfg, "path"), true).trim() || null,
	requireOk: policy.requireOk,
	acceptedStatus: policy.accepted
    };

    return { exportValue, policy, responsePolicyMeta, responseParse };
}

function normalizeLibRequestPayload(payload, url) {
    if (payload && typeof payload === "object") {
	if ("status" in payload || "ok" in payload || "body" in payload || "headers" in payload) {
	    return payload;
	}
    }

    return {
	ok: false,
	status: 0,
	statusText: "Invalid request payload",
	url: url || null,
	headers: {},
	body: payload,
    };
}

/**
 * Resolve effective request config for `http.send`.
 *
 * Parse contract:
 * - `args` is parsed with:
 *   `lib.args.parse(args, { adhoc:false }, { parms:"name buffer request adhoc url", pop:true })`
 * - `adhoc:false`:
 *   - missing `name` defaults to `"default"`
 * - `adhoc:true`:
 *   - `name` may be empty (no named base required)
 *
 * Merge order (left -> right):
 * 1) named request from `job.config.schema.requests[name]` (when name exists)
 * 2) `buffer.get()` when `buffer` flag is bool-yes
 * 3) inline `request` hash from args
 * 4) top-level `url` shorthand mapped to `request.endpoint.url`
 *
 * Merge semantics:
 * - uses `REQUEST_MERGE_OPTS` (array replacement; array+scalar overwrite)
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {*} [params.args]
 * @param {Object} params.buffer
 * @returns {{request:Object, refs:Array<string>}}
 *   Effective request object plus merge provenance references.
 * @throws {Error}
 *   When `name` is provided but request config does not exist.
 */
function resolveRequestConfig({ lib, job, args, buffer }) {
    const parsed = lib.args.parse(args, { adhoc: false }, { parms: "name buffer request adhoc url", pop: true });
    const adhoc = lib.bool.yes(parsed.adhoc);
    const nameRaw = lib.str.to(parsed.name, true).trim();
    const name = adhoc ? nameRaw : (nameRaw || "default");

    const requests = lib.hash.to(lib.hash.get(job, "config.schema.requests"));
    let out = {};
    const refs = [];

    if (!lib.utils.isEmpty(name)) {
	const found = lib.hash.get(requests, name);
	if (!lib.hash.is(found)) {
	    throw new Error(`http.send: request '${name}' was not found`);
	}
	out = lib.hash.to(found);
	refs.push(name);
    }

    if (lib.bool.yes(parsed.buffer)) {
	const fromBuffer = lib.hash.to(buffer.get());
	out = lib.hash.merge(out, fromBuffer, REQUEST_MERGE_OPTS) || out;
	refs.push("[buffer]");
    }

    const fromRequest = lib.hash.to(parsed.request);
    if (!lib.utils.isEmpty(fromRequest)) {
	out = lib.hash.merge(out, fromRequest, REQUEST_MERGE_OPTS) || out;
	refs.push("[request]");
    }

    const url = lib.str.to(parsed.url, true).trim();
    if (!lib.utils.isEmpty(url)) {
	lib.hash.set(out, "endpoint.url", url);
	refs.push("[url]");
    }

    return { request: out, refs };
}

function resolveHttpUrl(lib, request) {
    const direct = lib.str.to(lib.hash.get(request, "endpoint.url"), true).trim();
    if (!lib.utils.isEmpty(direct)) return direct;

    const host = lib.str.to(lib.hash.get(request, "endpoint.host"), true).trim();
    if (lib.utils.isEmpty(host)) return undefined;

    const scheme = lib.str.to(lib.hash.get(request, "endpoint.scheme"), true).trim().toLowerCase() || "http";
    const port = lib.hash.get(request, "endpoint.port");
    let path = lib.str.to(lib.hash.get(request, "endpoint.path"), true).trim();
    if (path && path.charAt(0) !== "/") path = `/${path}`;

    let url = `${scheme}://${host}${lib.utils.isEmpty(port) ? "" : `:${port}`}${path || ""}`;

    const query = lib.hash.to(lib.hash.get(request, "endpoint.query"));
    const qs = toQueryString(lib, query);
    if (!lib.utils.isEmpty(qs)) {
	url += (url.indexOf("?") === -1) ? `?${qs}` : `&${qs}`;
    }

    return url;
}

function hasHeader(headers, name) {
    const needle = String(name || "").trim().toLowerCase();
    if (!needle) return false;
    for (const key in headers) {
	if (!Object.prototype.hasOwnProperty.call(headers, key)) continue;
	if (String(key).toLowerCase() === needle) return true;
    }
    return false;
}

function normalizeRequestBody(lib, request, headers) {
    let body = request.body;
    const encoding = lib.str.to(request.encoding, true).trim().toLowerCase();
    const headerCT = lib.str.to(
	hasHeader(headers, "content-type")
	    ? (headers["content-type"] ?? headers["Content-Type"])
	    : "",
	true
    ).trim().toLowerCase();

    if (body === undefined || body === null) return { body, encoding };

    const isJsonMode =
	encoding === "json" ||
	encoding === "application/json" ||
	(encoding === "" && headerCT.indexOf("application/json") !== -1);

    const isFormMode =
	encoding === "urlencoded" ||
	encoding === "form" ||
	encoding === "application/x-www-form-urlencoded" ||
	(encoding === "" && headerCT.indexOf("application/x-www-form-urlencoded") !== -1);

    if (isJsonMode && (lib.hash.is(body) || lib.array.is(body))) {
	body = JSON.stringify(body);
	if (!hasHeader(headers, "content-type")) {
	    headers["content-type"] = "application/json";
	}
	return { body, encoding };
    }

    if (isFormMode && lib.hash.is(body)) {
	body = toQueryString(lib, body);
	if (!hasHeader(headers, "content-type")) {
	    headers["content-type"] = "application/x-www-form-urlencoded";
	}
    }

    return { body, encoding };
}

function storeHttpTransaction({ job, name, request, response, meta, type } = {}) {
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

function resolveFetchFn(lib) {
    const root = lib.hash.get(lib, "_env.root");
    const envFetch = root && root.fetch;
    if (typeof envFetch === "function") return envFetch.bind(root);
    if (typeof fetch === "function") return fetch.bind(globalThis);
    return null;
}

function resolveAbortController(lib) {
    const root = lib.hash.get(lib, "_env.root");
    if (root && typeof root.AbortController === "function") return root.AbortController;
    if (typeof AbortController === "function") return AbortController;
    return null;
}

function mapHeadersToArray(headers) {
    const out = [];
    for (const key in headers) {
	if (!Object.prototype.hasOwnProperty.call(headers, key)) continue;
	out.push({ name: key, value: headers[key] });
    }
    return out;
}

function resolveCredentialsMode(lib, request) {
    const creds = lib.hash.to(request.credentials);
    const mode = lib.str.to(creds.mode, true).trim();
    if (!lib.utils.isEmpty(mode)) return mode;
    if (lib.bool.yes(creds.withCredentials)) return "include";
    return undefined;
}

async function sendWithFetch({ lib, request, url, method, headers, body, timeoutMs }) {
    const fetchFn = resolveFetchFn(lib);
    if (!fetchFn) return undefined;

    const opts = { method, headers };
    if (body !== undefined) opts.body = body;

    const credentials = resolveCredentialsMode(lib, request);
    if (!lib.utils.isEmpty(credentials)) opts.credentials = credentials;

    let timer = null;
    const AbortCtor = resolveAbortController(lib);
    if (AbortCtor && timeoutMs > 0) {
	const ctl = new AbortCtor();
	opts.signal = ctl.signal;
	timer = setTimeout(() => ctl.abort(), timeoutMs);
    }

    try {
	const response = await fetchFn(url, opts);
	return await normalizeFetchResponse(response);
    } finally {
	if (timer) clearTimeout(timer);
    }
}

async function sendWithXhr({ lib, request, url, method, headers, body, encoding, responseParse }) {
    const http = lib._http;
    if (!http || typeof http.request !== "function") {
	throw new Error("http.send: no HTTP transport available (fetch/_http.request)");
    }

    const creds = lib.hash.to(request.credentials);
    const withCreds = lib.bool.yes(creds.withCredentials) || lib.str.to(creds.mode, true).trim() === "include";

    return await new Promise((resolve, reject) => {
	try {
	    http.request(url, {
		method,
		body,
		header: mapHeadersToArray(headers),
		urlencoded: encoding === "urlencoded" ? 1 : 0,
		json: responseParse === "json" ? 1 : 0,
		credentials: withCreds,
		load: function (xhr) {
		    resolve(normalizeXhrResponse(xhr, url));
		},
		error: function (xhr) {
		    // no response validation here; surface server failures as payload
		    resolve(normalizeXhrResponse(xhr, url));
		}
	    });
	} catch (err) {
	    reject(err);
	}
    });
}

/**
 * `http.send` builtin.
 *
 * Args contract:
 * - `args` accepts hash or array forms via:
 *   `lib.args.parse(args, { adhoc:false }, { parms:"name buffer request adhoc", pop:true })`
 * - `adhoc`   : when true, request name may be omitted
 * - `name`    : request key lookup from `job.config.schema.requests`
 *               (defaults to "default" when `adhoc` is false)
 * - `buffer`  : boolish; when true, merges `buffer.get()` into request config
 * - `request` : hash override merged last
 *
 * Merge model:
 * - entries are merged left->right (later entries win).
 * - arrays are replaced (not concatenated).
 *
 * Transport policy:
 * - this builtin supports only HTTP transport.
 * - `transport` must be `"http"` or empty.
 *
 * Output model:
 * - delegates transport to `lib.request.send(...)` and awaits normalized payload
 * - applies optional `request.response` policy controls:
 *   - parse / return / path projection
 *   - requireOk / acceptedStatus gating
 * - writes projected response value into `buffer`
 * - writes request/response summary into `buffer.meta`
 * - on response-policy failure, still writes buffer/meta then returns `SR_error`
 */
export default async function httpSend({ job, lib, args, buffer, inputs, step } = {}) {
    try {
	const { request, refs } = resolveRequestConfig({ lib, job, args, buffer });

	const transport = lib.str.to(request.transport, true).trim().toLowerCase();
	if (!lib.utils.isEmpty(transport) && transport !== "http") {
	    return helpers.SR_error(new Error(`http.send: unsupported transport '${transport}'`), {
		op: "http.send",
		step,
		transport
	    });
	}

	const url = resolveHttpUrl(lib, request);
	if (lib.utils.isEmpty(url)) {
	    return helpers.SR_error(new Error("http.send: missing endpoint.url (or endpoint host/scheme/path)"), {
		op: "http.send",
		step
	    });
	}

	const method = lib.str.to(request.method, true).trim().toUpperCase() || "GET";
	const headers = lib.hash.to(request.headers);
	const timeoutMs = lib.number.toInt(request.timeoutMs, 0);
	const responseCfg = lib.hash.to(request.response);

	// Route transport through lib.request and force payload return so
	// ActiveTags can apply its existing response projection + policy model.
	const sendRequest = lib.hash.deepCopy(request);
	const sendResponseCfg = lib.hash.to(sendRequest.response);
	sendResponseCfg.parse = lib.str.to(lib.hash.get(responseCfg, "parse"), true).trim().toLowerCase() || "auto";
	sendResponseCfg.return = "payload";
	delete sendResponseCfg.path;
	sendRequest.response = sendResponseCfg;

	let payload = await lib.request.send(sendRequest);
	payload = normalizeLibRequestPayload(payload, url);

	const outcome = resolveResponseOutcome({ lib, payload, responseCfg });
	const txName = lib.str.to(refs[0], true).trim();
	storeHttpTransaction({
	    job,
	    name: (!lib.utils.isEmpty(txName) && txName.charAt(0) !== "[") ? txName : "default",
	    request: request,
	    response: payload,
	    type: "HTTP/1",
	    meta: { op: "http.send", refs, step },
	});

	const meta = {
	    http: {
		op: "http.send",
		refs,
			request: {
			    transport: transport || "http",
			    url,
			    method,
			    encoding: lib.str.to(request.encoding, true).trim().toLowerCase() || null,
			    timeoutMs: timeoutMs > 0 ? timeoutMs : null,
			    headers
			},
		response: {
		    ok: payload && ("ok" in payload) ? !!payload.ok : null,
		    status: payload && ("status" in payload) ? payload.status : null
		},
		responsePolicy: outcome.responsePolicyMeta
	    }
	};

	buffer.set(outcome.exportValue, meta);
	if (inputs && typeof inputs === "object") inputs.response = outcome.exportValue;

	if (!outcome.policy.pass) {
	    return helpers.SR_error(new Error(`http.send: response policy failed (${outcome.policy.reason})`), {
		op: "http.send",
		step,
		reason: outcome.policy.reason,
		status: outcome.policy.status,
		refs
	    });
	}

	return helpers.SR_ok({
	    op: "http.send",
	    step,
	    refs,
	    url,
	    method,
	    status: payload && ("status" in payload) ? payload.status : null
	});
    } catch (err) {
	return helpers.SR_error(err, { op: "http.send", step });
    }
}
