/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

const RUNTIME_PATHS = Object.freeze({
    dev: "/vendor/m7-js-lib-active-tags/src/standalone/prebundle.js",
    dist: "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js",
});

// Runtime selector:
// - ?runtime=dev  -> source standalone prebundle
// - ?runtime=dist -> versioned minified bundle
function resolveRuntimeMode() {
    const params = new URLSearchParams(window.location.search);
    const runtime = String(params.get("runtime") || "dist").trim().toLowerCase();
    return runtime === "dist" ? "dist" : "dev";
}

async function loadRuntimeModule(mode) {
    const path = RUNTIME_PATHS[mode] || RUNTIME_PATHS.dev;
    const mod = await import(path);

    if (!mod || typeof mod.install !== "function" || typeof mod.SERVICE_ID !== "string") {
        throw new Error(`[headlessJobs] invalid runtime module '${path}'.`);
    }

    return { mod, path };
}

const HEADLESS_JOB_NAME = "headless-clock-demo";
const HEADLESS_INTERVAL_NAME = "clock";

function setText(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = String(value);
}

function updateRegistryView(AT) {
    const names = (AT && AT.jobs && typeof AT.jobs.listNames === "function")
	  ? AT.jobs.listNames()
	  : [];
    const ids = (AT && AT.jobs && typeof AT.jobs.listIds === "function")
	  ? AT.jobs.listIds()
	  : [];

    setText("#headless-job-names", JSON.stringify(names));
    setText("#headless-job-ids", JSON.stringify(ids));
}

function tickHeadless({ job, buffer, lib, inputs } = {}) {
    const ws = (job && job.ws) ? job.ws : {};
    const currentCount = Number(lib.hash.get(ws, "headless.counter"));
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
    const timestamp = Date.now();

    lib.hash.set(ws, "headless.counter", nextCount);
    lib.hash.set(ws, "headless.lastAt", timestamp);

    if (buffer && typeof buffer.set === "function") {
	buffer.set(
	    {
		count: nextCount,
		timestamp,
		reason: (inputs && inputs.reason) || "interval",
	    },
	    { source: "headless.tick" }
	);
    }

    return true;
}

function renderHeadless({ buffer, AT } = {}) {
    const payload = (buffer && typeof buffer.get === "function")
	  ? (buffer.get() || {})
	  : {};

    const count = Number(payload.count) || 0;
    const timestamp = Number(payload.timestamp) || 0;
    const timeText = timestamp ? new Date(timestamp).toLocaleTimeString() : "-";

    setText("#headless-output", `count=${count} at ${timeText}`);
    updateRegistryView(AT);

    return true;
}

function headlessError({ error } = {}) {
    const msg = (error && error.message) ? error.message : "unknown error";
    setText("#headless-status", `error: ${msg}`);
    return true;
}

async function createRuntime() {
    const runtimeMode = resolveRuntimeMode();
    const runtime = await loadRuntimeModule(runtimeMode);
    const { install, SERVICE_ID } = runtime.mod;

    const conf = {
        boot: {
            intervals: true,
            events: true,
        },
        engine: {
            opResolution: {
                auto: true,
            },
        },
        job: {
            config: {
                evalEnabled: true,
                evalType: "text/at-eval",
                importEnabled: true,
                importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
            },
        },
    };

    const lib = install({ conf });
    const AT = lib.service.get(SERVICE_ID);
    if (!AT) throw new Error(`[headlessJobs] missing ActiveTags service '${SERVICE_ID}'.`);

    await AT.start();
    window.lib = lib;
    window.AT = AT;
    window.activeTagsRuntime = {
        mode: runtimeMode,
        path: runtime.path,
    };

    return AT;
}

async function runOnce(AT, job) {
    const ticket = AT.engine.enqueue(job, "tick", {
	inputs: {
	    reason: "manual",
	},
	meta: {
	    source: "headless-example",
	},
    });

    if (!ticket) return;
    await AT.engine.drain({ ticket });
}

async function mountHeadlessExample(AT) {
    const def = {
	name: "Headless Clock Demo",
	enabled: true,
	autorun: false,
	pipelines: {
	    tick: {
		run: [tickHeadless, renderHeadless],
		error: [headlessError, "error.dump"],
	    },
	},
	intervals: {
	    [HEADLESS_INTERVAL_NAME]: {
		repeat: 1000,
		pipeline: "tick",
		allowOverlap: false,
		onError: "continue",
	    },
	},
    };

    const resp = await AT.runtime.createHeadlessJob(HEADLESS_JOB_NAME, def);
    const job = resp.job;

    AT.intervals.register(job);
    AT.intervals.on(job, HEADLESS_INTERVAL_NAME);

    setText(
	"#headless-status",
	resp.created
	    ? `created headless job (${job.id})`
	    : `reused headless job (${job.id})`
    );

    updateRegistryView(AT);
    await runOnce(AT, job);

    const startBtn = document.querySelector("#headless-start");
    const stopBtn = document.querySelector("#headless-stop");
    const tickBtn = document.querySelector("#headless-tick");

    if (startBtn) {
	startBtn.addEventListener("click", () => {
	    AT.intervals.on(job, HEADLESS_INTERVAL_NAME);
	    setText("#headless-status", `interval on (${job.id})`);
	});
    }

    if (stopBtn) {
	stopBtn.addEventListener("click", () => {
	    AT.intervals.off(job, HEADLESS_INTERVAL_NAME);
	    setText("#headless-status", `interval off (${job.id})`);
	});
    }

    if (tickBtn) {
	tickBtn.addEventListener("click", async () => {
	    await runOnce(AT, job);
	    setText("#headless-status", `manual tick (${job.id})`);
	});
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    setText("#headless-status", "starting runtime...");

    try {
	const AT = await createRuntime();
	await mountHeadlessExample(AT);
    } catch (err) {
	console.error(err);
	setText("#headless-status", `startup error: ${err && err.message ? err.message : "unknown"}`);
    }
});
