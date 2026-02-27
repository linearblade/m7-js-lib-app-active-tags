/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

function prepareRequestFromInput({ lib, job, buffer } = {}) {
    const root = job.e;
    const input = root.querySelector("#request-http-url");
    const parseEl = root.querySelector("#request-http-parse");
    const returnEl = root.querySelector("#request-http-return");
    const requireOkEl = root.querySelector("#request-http-require-ok");
    const pathEl = root.querySelector("#request-http-path");
    const acceptedEl = root.querySelector("#request-http-accepted");

    const defaultUrl = lib.hash.get(job, "config.schema.requests.default.endpoint.url");
    const defaultResp = lib.hash.to(lib.hash.get(job, "config.schema.requests.default.response"));

    const url = (input && typeof input.value === "string")
	? input.value.trim()
	: "";
    const parseMode = (parseEl && typeof parseEl.value === "string" && parseEl.value.trim())
	? parseEl.value.trim()
	: (lib.hash.get(defaultResp, "parse") || "auto");
    const returnMode = (returnEl && typeof returnEl.value === "string" && returnEl.value.trim())
	? returnEl.value.trim()
	: (lib.hash.get(defaultResp, "return") || "payload");
    const requireOk = !!(requireOkEl && requireOkEl.checked);
    const path = (pathEl && typeof pathEl.value === "string")
	? pathEl.value.trim()
	: "";

    const acceptedRaw = (acceptedEl && typeof acceptedEl.value === "string")
	? acceptedEl.value
	: "";
    const acceptedStatus = acceptedRaw
	.split(",")
	.map(x => Number(String(x).trim()))
	  .filter(x => Number.isInteger(x) && parseInt(x)>0);

    const response = {
	parse: parseMode,
	return: returnMode,
	requireOk,
	acceptedStatus,
    };
    if (path) response.path = path;

    buffer.set({
	endpoint: {
	    url: url || defaultUrl
	},
	response,
    }, { source: "requestHTTP.prepareRequestFromInput" });

    return true;
}

function renderResponse({ job, buffer } = {}) {
    const root = job.e;
    const statusEl = root.querySelector("#request-http-status");
    const outputEl = root.querySelector("#request-http-output");

    const payload = buffer.get();
    const meta = buffer.meta();
    const status = libSafeGet(meta, "http.response.status");

    if (statusEl) {
	statusEl.textContent = status == null ? "unknown" : String(status);
    }

    if (outputEl) {
	outputEl.textContent = stringify(payload);
    }

    return true;
}

function renderError({ job, ticket } = {}) {
    const root = job.e;
    const statusEl = root.querySelector("#request-http-status");
    const outputEl = root.querySelector("#request-http-output");
    const err = ticket && ticket.last && ticket.last.error;
    const message = err && err.message ? err.message : "request failed";

    if (statusEl) statusEl.textContent = "error";
    if (outputEl) outputEl.textContent = message;

    return true;
}

function stringify(value) {
    if (value == null) return String(value);
    if (typeof value === "string") return value;

    try {
	return JSON.stringify(value, null, 2);
    } catch (err) {
	return String(value);
    }
}

function libSafeGet(src, path) {
    if (!src || typeof src !== "object") return undefined;
    const tokens = String(path || "").split(".").filter(Boolean);
    let cur = src;
    for (const key of tokens) {
	if (cur == null || !(key in cur)) return undefined;
	cur = cur[key];
    }
    return cur;
}
//if you want to see whats going on.
function dumpBuffer({buffer}){
    console.warn(buffer.meta() , buffer.get());
    return true;
}
export default {
    name: "request-http",
    enabled: true,
    autorun: false,

    pipeline: {
	run: [
	    "@confirm",
	    prepareRequestFromInput,
	    //dumpBuffer,
	    { op: "@http.send", args: { buffer: true } },
	    dumpBuffer,
	    renderResponse
	],
	error: [
	    renderError,
	    //dumpBuffer,
	    "@error.dump"
	]
    },

    events: {
	send_click: {
	    event: "click",
	    selector: "#request-http-send",
	    pipeline: "default"
	}
    },

    requests: {
	default: {
	    transport: "http",
	    endpoint: {
		url: "https://jsonplaceholder.typicode.com/todos/1"
	    },
	    method: "GET",
	    response: {
		parse: "json",
		return: "body"
	    }
	}
    },

    env: {
	section: "requestHTTP"
    }
};
