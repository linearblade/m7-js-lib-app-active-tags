/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Discover sweep/scan + runtime attach/dispose (observer path without MutationObserver).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    createAT,
    createDomEnv,
    createActiveTagElement,
} from "../helpers/index.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDomAT(extraConf = {}) {
    const env = createDomEnv();
    const harness = createAT(
        {
            env,
            boot: {
                selector: "[data-activetag]",
                observeDom: false,
                events: false,
                intervals: false,
            },
            observe: {
                runtimeAttach: true,
                runtimeDispose: true,
            },
            job: {
                config: {
                    importEnabled: false,
                },
            },
            ...extraConf,
        },
        { env }
    );
    return { ...harness, env };
}

test("discover.sweep finds data-activetag hosts and ignores others", () => {
    const { AT, env } = makeDomAT();

    assert.equal(AT.discover.sweep().length, 0);

    const host = createActiveTagElement(env.document, { "at-name": "sweep-a" });
    const noise = env.document.createElement("span");
    env.document.body.appendChild(noise);
    env.document.body.appendChild(host);

    const found = AT.discover.sweep();
    assert.equal(found.length, 1);
    assert.equal(found[0], host);
});

test("discover.scan registers jobs for hosts and is idempotent per element", async () => {
    const { AT, env, lib } = makeDomAT();

    const host = createActiveTagElement(env.document, { "at-name": uniqueName("scan") });
    env.document.body.appendChild(host);
    assert.equal(lib.dom.is(host), true);

    const first = await AT.discover.scan();
    assert.equal(first.length, 1);
    assert.ok(first[0].id);
    assert.equal(AT.jobs.hasElement(host), true);
    assert.equal(AT.jobs.getByElement(host)?.id, first[0].id);

    const second = await AT.discover.scan();
    assert.equal(second.length, 1);
    assert.equal(second[0].id, first[0].id, "same element must not create a second job");
    assert.equal(AT.jobs.list().length, 1);
});

test("runtime.attachObservedNodes registers fresh nodes and skips already-known ones", async () => {
    const { AT, env } = makeDomAT();

    const host = createActiveTagElement(env.document, { "at-name": uniqueName("attach") });
    // Not required to be under body for attachObservedNodes, but matches real observer output.
    env.document.body.appendChild(host);

    const first = await AT.runtime.attachObservedNodes([host], { reason: "test.attach" });
    assert.ok(first.jobs.length >= 1);
    assert.equal(AT.jobs.hasElement(host), true);
    assert.ok(first.count >= 0);

    const second = await AT.runtime.attachObservedNodes([host], { reason: "test.attach" });
    assert.equal(second.jobs.length, 0, "already registered elements are not re-registered");
    assert.equal(second.count, 0);
    assert.equal(AT.jobs.list().filter((j) => j.e === host).length, 1);
});

test("runtime.disposeJob tears down registry binding for an element", async () => {
    const { AT, env } = makeDomAT();

    const host = createActiveTagElement(env.document, { "at-name": uniqueName("dispose") });
    env.document.body.appendChild(host);

    await AT.runtime.attachObservedNodes([host], { reason: "test.dispose" });
    assert.equal(AT.jobs.hasElement(host), true);
    const job = AT.jobs.getByElement(host);
    assert.ok(job?.id);

    const ok = AT.runtime.disposeJob(job, { reason: "test.dispose" });
    assert.equal(ok, true);
    assert.equal(AT.jobs.hasElement(host), false);
    assert.equal(AT.jobs.getById(job.id), null);
});

test("runtime.disposeJobs accepts element list and dedupes by job id", async () => {
    const { AT, env } = makeDomAT();

    const a = createActiveTagElement(env.document, { "at-name": uniqueName("dja") });
    const b = createActiveTagElement(env.document, { "at-name": uniqueName("djb") });
    env.document.body.appendChild(a);
    env.document.body.appendChild(b);

    await AT.runtime.attachObservedNodes([a, b], { reason: "test.batch" });
    assert.equal(AT.jobs.hasElement(a), true);
    assert.equal(AT.jobs.hasElement(b), true);

    const jobA = AT.jobs.getByElement(a);
    // Pass element twice + job ref to exercise dedupe.
    const n = AT.runtime.disposeJobs([a, a, jobA, b], { reason: "test.batch" });
    assert.equal(n, 2);
    assert.equal(AT.jobs.hasElement(a), false);
    assert.equal(AT.jobs.hasElement(b), false);
});

test("createJob with DOM element anchors registry by element", async () => {
    const { AT, env } = makeDomAT();
    const host = createActiveTagElement(env.document);
    env.document.body.appendChild(host);

    const name = uniqueName("anchored");
    const { job, created } = await AT.runtime.createJob({
        name,
        e: host,
        def: {
            name,
            enabled: true,
            pipelines: {
                default: {
                    run: [() => true],
                },
            },
        },
        opts: { configure: "from", indexElement: true },
    });

    assert.equal(created, true);
    assert.equal(job.e, host);
    assert.equal(AT.jobs.getByElement(host), job);
    assert.equal(job.config.status, "ready");
});
