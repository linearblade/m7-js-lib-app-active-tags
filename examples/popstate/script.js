/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import { install, SERVICE_ID } from "./vendor/m7-js-lib-app-active-tags/src/standalone/prebundle.js";

async function seedIndex(AT) {
    if (!AT || typeof AT.toJob !== "function" || !AT.engine) {
        return null;
    }

    const job = AT.toJob("popstate-nav");
    if (!job || !job.id) {
        return null;
    }

    const ticket = AT.engine.enqueue(job, "seed_index", {
        // Run the configured seed pipeline once at startup.
        inputs: {
            reason: "seed",
        },
        meta: {
            source: "seed",
        },
    });

    await AT.engine.drain({ ticket, ctx: {} });
    await AT.engine.drain({ requireJob: job, ctx: {}, max: 25 });
    return ticket;
}

async function boot() {
    const lib = install({
        popstate: true,
    });

    const AT = lib && lib.service && typeof lib.service.get === "function"
        ? lib.service.get(SERVICE_ID)
        : null;

    window.lib = lib;
    window.AT = AT;

    if (!AT) {
        throw new Error(`[popstate sandbox] missing ActiveTags service '${SERVICE_ID}'.`);
    }

    await AT.start();
    // Manual seed path retained for comparison.
    // await seedIndex(AT);
}

document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
        console.error(err);
    });
});
