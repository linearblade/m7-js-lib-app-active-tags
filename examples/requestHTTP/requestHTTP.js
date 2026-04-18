/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

const RUNTIME_PATHS = Object.freeze({
    dev: "/vendor/m7-js-lib-active-tags/src/standalone/prebundle.js",
    dist: "/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js",
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
        throw new Error(`[requestHTTP] invalid runtime module '${path}'.`);
    }

    return { mod, path };
}

//leave in place for any auto deps we may later have
const requestHttpAutoDeps = [
    //"/vendor/m7-js-lib-tree/src/auto.js",
    //"/vendor/m7-js-workspace/src/auto.js",
];

async function loadRequestHttpDeps() {
    for (const modPath of requestHttpAutoDeps) {
	await import(modPath);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadRequestHttpDeps();
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
    if (!AT) throw new Error(`[requestHTTP] missing ActiveTags service '${SERVICE_ID}'.`);

    await AT.start();
    window.lib = lib;
    window.AT = AT;
    window.activeTagsRuntime = {
        mode: runtimeMode,
        path: runtime.path,
    };
});
