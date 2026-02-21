function renderCollected({ job, buffer, ticket, lib } = {}) {
    const root = job && job.e;
    const statusEl = root && root.querySelector ? root.querySelector("#collect-status") : null;
    const outputEl = root && root.querySelector ? root.querySelector("#collect-output") : null;
    const collected = buffer && typeof buffer.get === "function" ? buffer.get() : null;

    if (!collected || !Array.isArray(collected.parms)) {
        if (statusEl) statusEl.textContent = "no payload";
        if (outputEl) outputEl.textContent = "{}";
        return false;
    }

    const triggerEl = collected.event || (ticket && ticket.target) || null;
    const triggerName = triggerEl && triggerEl.name ? triggerEl.name : null;
    const triggerValue = triggerEl && triggerEl.value ? triggerEl.value : null;
    const triggerId = triggerEl && triggerEl.id ? triggerEl.id : null;

    const flat = lib.dom.form.toJson(collected, { inflate: false });
    const structured = lib.dom.form.toJson(collected, { inflate: true });

    const payload = {
        url: collected.url || null,
        method: collected.method || null,
        count: collected.parms.length,
        trigger: {
            id: triggerId,
            name: triggerName,
            value: triggerValue
        },
        parms: collected.parms,
        flat,
        structured
    };

    if (statusEl) statusEl.textContent = triggerId || triggerName || "unknown";
    if (outputEl) outputEl.textContent = JSON.stringify(payload, null, 2);
    return true;
}

function injectEnvelope({ buffer, lib, job } = {}) {
    const envelope = lib.hash.to(buffer.get());
    if (lib.hash.empty(envelope)) {
        throw new Error("injectEnvelope: expected request envelope in buffer");
    }

    const traceId = `demo-${Date.now()}`;
    let body = envelope.body;

    if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (err) { body = { raw: body }; }
    } else if (!lib.hash.is(body)) {
        body = { value: body };
    }

    body.injected = Object.assign({}, lib.hash.to(body.injected), {
        source: "forms/collect_envelope_inject",
        section: lib.hash.get(job, "env.section") || "formCollectEnvelopeInject",
        traceId,
        submittedBy: "example-user",
        featureFlags: {
            canary: true,
            envelopeEdited: true
        }
    });

    body.server = Object.assign({}, lib.hash.to(body.server), {
        tenant: "tilesphere-demo",
        apiVersion: "2026-02"
    });

    envelope.body = body;

    envelope.headers = Object.assign({}, lib.hash.to(envelope.headers), {
        "X-Demo-Flow": "collect-envelope-inject",
        "X-Trace-Id": traceId,
        "X-Client-App": "ActiveTags Examples",
        "Authorization": "Bearer demo-server-key-abc123"
    });

    const query = lib.hash.to(lib.hash.get(envelope, "endpoint.query"));
    query.trace = traceId;
    query.injected = "1";
    lib.hash.set(envelope, "endpoint.query", query);

    buffer.set(envelope);
    return true;
}

export default {
    name: "form-collect",
    enabled: true,
    autorun: false,

    pipelines: {
        collect: {
            run: [
                "@form.collect",
                renderCollected
            ],
            error: [
                "@error.dump"
            ]
        },
        submit: {
	    run : [
		//{ op: "@form.collect" },
		{ op: "@buffer.dump", args: { label: "before envelope" } },
		{ op: "@form.toEnvelope", args: {json:true, structure:true} },
		{ op: "@buffer.dump", args: { label: "after toEnvelope" } },
                injectEnvelope,
		{ op: "@buffer.dump", args: { label: "after envelope inject" } },
                { op: "@buffer.assert", args: { key: "headers.Authorization", value: "Bearer demo-server-key-abc123" } },
		{ op: "@http.send", args: { adhoc: true, buffer: true } },
		{ op: "@buffer.dump", args: { label: "after http.send" } },
	    ],
            oldrun: [
                { op: "@form.submit", args: { mode: "ajax", contentType: "json", response: "json",structured:false } },
                { op: "@buffer.dump", args: { label: "after submit" } },
                { op: "@buffer.assert", args: { key: "ok", value: true } },
                { op: "@buffer.assert", args: { key: "result", predicate: "lib.bool.yes" } },

            ],
            error: [
                "@error.dump"
            ]
        }
    },

    events: {
        collect_click: {
            event: "click",
            selector: "#collectBtn",
            pipeline: "collect"
        },
        submit_click: {
            event: "click",
            selector: "#submitBtn",
            pipeline: "submit"
        }
    },

    env: {
        section: "formCollectEnvelopeInject"
    }
};
