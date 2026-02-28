/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

const RUNTIME_PATHS = Object.freeze({
  dev: "/vendor/m7-js-lib-active-tags/src/standalone/prebundle.js",
  dist: "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js",
});

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = String(value);
}

function resolveRuntimeMode() {
  const params = new URLSearchParams(window.location.search);
  const runtime = String(params.get("runtime") || "dist").trim().toLowerCase();
  return runtime === "dist" ? "dist" : "dev";
}

async function loadRuntimeModule(mode) {
  const path = RUNTIME_PATHS[mode] || RUNTIME_PATHS.dev;
  const mod = await import(path);

  if (!mod || typeof mod.install !== "function" || typeof mod.SERVICE_ID !== "string") {
    throw new Error(`[tutorial] invalid runtime module '${path}'.`);
  }

  return { mod, path };
}

document.addEventListener("DOMContentLoaded", async () => {
  setText("#tutorial-status", "starting runtime...");

  try {
    const runtimeMode = resolveRuntimeMode();
    const runtime = await loadRuntimeModule(runtimeMode);
    const { install, SERVICE_ID } = runtime.mod;

    const conf = {
      boot: {
        observeDom: true,
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
    if (!AT) throw new Error(`[tutorial] missing ActiveTags service '${SERVICE_ID}'.`);

    await AT.start();

    const loadedJob = AT.toJob("tutorial-loaded");
    if (loadedJob) {
      const ticket = AT.engine.enqueue(loadedJob, "default", {
        inputs: { reason: "tutorial.startup" },
        meta: { source: "tutorial-example" },
      });
      if (ticket) await AT.engine.drain({ ticket });
    }

    const services = lib.service && typeof lib.service.list === "function"
      ? lib.service.list()
      : [];

    setText("#tutorial-status", `ready (${runtimeMode})`);
    setText("#tutorial-services", JSON.stringify(services));

    window.lib = lib;
    window.AT = AT;
    window.activeTagsRuntime = {
      mode: runtimeMode,
      path: runtime.path,
    };
  } catch (err) {
    console.error(err);
    setText("#tutorial-status", `startup error: ${err && err.message ? err.message : "unknown"}`);
  }
});
