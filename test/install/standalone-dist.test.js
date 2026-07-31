/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Standalone dist smoke:
 * Import the shipped min bundle and call install() — the consumer path.
 *
 * Skips when dist is not built (day-to-day source tests stay green).
 * release-check already requires dist artifacts, so this runs there for real.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
const DIST_NOMAP = join(
    ROOT,
    "dist/nomap",
    `activeTags.standalone.v${VERSION}.min.js`
);

function distPresent() {
    return existsSync(DIST_NOMAP);
}

/**
 * Minimal host surface for standalone install under Node.
 * EventDelegator requires root addEventListener/removeEventListener.
 */
function installNodeHostShim() {
    if (typeof globalThis.Element !== "function") {
        globalThis.Element = class Element {
            constructor() {
                this.nodeType = 1;
            }
        };
    }

    const listeners = new Map();
    const document = {
        body: {
            nodeType: 1,
            tagName: "BODY",
            querySelectorAll() {
                return [];
            },
        },
        baseURI: "http://active-tags.test/",
        querySelectorAll() {
            return [];
        },
        createElement(tag) {
            return {
                nodeType: 1,
                tagName: String(tag || "DIV").toUpperCase(),
                querySelectorAll() {
                    return [];
                },
            };
        },
        addEventListener(type, fn) {
            listeners.set(`doc:${type}`, fn);
        },
        removeEventListener(type, fn) {
            if (listeners.get(`doc:${type}`) === fn) listeners.delete(`doc:${type}`);
        },
    };

    const window = {
        document,
        location: { href: "http://active-tags.test/" },
        addEventListener(type, fn) {
            listeners.set(`win:${type}`, fn);
        },
        removeEventListener(type, fn) {
            if (listeners.get(`win:${type}`) === fn) listeners.delete(`win:${type}`);
        },
    };

    globalThis.document = document;
    globalThis.window = window;
    globalThis.location = window.location;

    return { window, document, listeners };
}

async function loadDistModule() {
    return import(pathToFileURL(DIST_NOMAP).href);
}

test("standalone dist exports install surface", async (t) => {
    if (!distPresent()) {
        t.skip(`dist missing (build first): ${DIST_NOMAP}`);
        return;
    }

    const mod = await loadDistModule();
    assert.equal(typeof mod.install, "function");
    assert.equal(typeof mod.SERVICE_ID, "string");
    assert.ok(mod.SERVICE_ID.length > 0);
    assert.equal(typeof mod.ActiveTags, "function");
    assert.ok(typeof mod.VERSION === "string" && mod.VERSION.length > 0);
    // VERSION file should match bundle-injected version when dist is current.
    assert.equal(mod.VERSION, VERSION);
});

test("standalone dist install() registers ActiveTags service", async (t) => {
    if (!distPresent()) {
        t.skip(`dist missing (build first): ${DIST_NOMAP}`);
        return;
    }

    const { window, document } = installNodeHostShim();
    const mod = await loadDistModule();

    const lib = mod.install({
        force: true,
        spa: false,
        popstate: true,
        conf: {
            env: {
                root: window,
                window,
                document,
            },
            boot: {
                observeDom: false,
                events: false,
                intervals: false,
            },
            log: {
                enabled: false,
            },
        },
    });

    assert.ok(lib && typeof lib === "object");
    assert.equal(typeof lib.service?.get, "function");

    const AT = lib.service.get(mod.SERVICE_ID);
    assert.ok(AT, `missing service ${mod.SERVICE_ID}`);
    assert.equal(typeof AT.start, "function");
    assert.ok(AT.engine, "expected engine on AT instance");
    assert.ok(AT.jobs, "expected jobs registry on AT instance");
    assert.equal(AT.VERSION, mod.VERSION);
});

test("standalone dist can create headless job and drain a pipeline", async (t) => {
    if (!distPresent()) {
        t.skip(`dist missing (build first): ${DIST_NOMAP}`);
        return;
    }

    const { window, document } = installNodeHostShim();
    const mod = await loadDistModule();

    const lib = mod.install({
        force: true,
        spa: false,
        popstate: true,
        conf: {
            env: {
                root: window,
                window,
                document,
            },
            boot: {
                observeDom: false,
                events: false,
                intervals: false,
            },
            log: {
                enabled: false,
            },
        },
    });

    const AT = lib.service.get(mod.SERVICE_ID);
    assert.ok(AT);

    const { job, created } = await AT.runtime.createHeadlessJob(
        `dist-smoke-${Date.now().toString(36)}`,
        {
            name: "dist-smoke",
            enabled: true,
            pipelines: {
                default: {
                    run: [
                        ({ buffer }) => {
                            buffer.set({ ok: true, from: "standalone-dist" });
                            return true;
                        },
                    ],
                },
            },
        }
    );

    assert.equal(created, true);
    assert.ok(job?.id);

    const { ticket, created: ticketCreated } = AT.engine.enqueue(job, "default", {
        returnMeta: true,
    });
    assert.equal(ticketCreated, true);

    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.deepEqual(ticket.buffer.get(), {
        ok: true,
        from: "standalone-dist",
    });
});
