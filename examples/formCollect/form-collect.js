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

function forceXhrFallbackForDemo({ job } = {}) {
    const root = (typeof globalThis !== "undefined")
        ? globalThis
        : ((typeof window !== "undefined") ? window : null);
    if (!root) return true;

    const meta = (job && typeof job === "object")
        ? (job.meta || (job.meta = {}))
        : {};

    if (meta.__demoFetchForced) return true;

    meta.__demoFetchHadValue = ("fetch" in root);
    meta.__demoFetchOriginal = root.fetch;
    root.fetch = function forcedFetchFailure() {
        return Promise.reject(new Error("forced fetch failure for XHR fallback demo"));
    };
    meta.__demoFetchForced = true;
    return true;
}

function restoreFetchAfterDemo({ job } = {}) {
    const root = (typeof globalThis !== "undefined")
        ? globalThis
        : ((typeof window !== "undefined") ? window : null);
    if (!root) return true;

    const meta = (job && job.meta) ? job.meta : null;
    if (!meta || !meta.__demoFetchForced) return true;

    if (meta.__demoFetchHadValue) root.fetch = meta.__demoFetchOriginal;
    else delete root.fetch;

    delete meta.__demoFetchForced;
    delete meta.__demoFetchOriginal;
    delete meta.__demoFetchHadValue;
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
		{ op: "@buffer.dump", args: { label: "after envelope" } },
                forceXhrFallbackForDemo,
		{ op: "@http.send", args: { adhoc: true, buffer: true } },
                restoreFetchAfterDemo,
		{ op: "@buffer.dump", args: { label: "after http.send" } },
	    ],
            oldrun: [
                { op: "@form.submit", args: { mode: "ajax", contentType: "json", response: "json",structured:false } },
                { op: "@buffer.dump", args: { label: "after submit" } },
                { op: "@buffer.assert", args: { key: "ok", value: true } },
                { op: "@buffer.assert", args: { key: "result", predicate: "lib.bool.yes" } },

            ],
            error: [
                restoreFetchAfterDemo,
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
        section: "formCollect"
    }
};
