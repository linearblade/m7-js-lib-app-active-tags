/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * EventController install + enqueue path:
 * - register/on installs through delegator
 * - handler enqueues with returnMeta
 * - second fire while ticket live does not double-step (created === false)
 * - remove/off uninstalls handler
 */

import test from "node:test";
import assert from "node:assert/strict";

import CONSTANTS from "../../src/constants.js";
import {
    createAT,
    createDomEnv,
    createActiveTagElement,
    createRecordingDelegator,
} from "../helpers/index.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEventAT() {
    const env = createDomEnv();
    const delegator = createRecordingDelegator();
    const harness = createAT(
        {
            env,
            boot: {
                selector: "[data-activetag]",
                observeDom: false,
                events: false,
                intervals: false,
            },
            job: {
                config: {
                    importEnabled: false,
                },
            },
            observe: {
                runtimeAttach: true,
                runtimeDispose: true,
            },
        },
        {
            env,
            services: {
                [CONSTANTS.SERVICE_DELEGATOR]: delegator,
            },
        }
    );

    assert.equal(harness.AT.svc.delegator, delegator);
    assert.equal(harness.AT.events.delegator, delegator);

    return { ...harness, env, delegator };
}

async function createClickJob(AT, env, { slowMs = 0, name = uniqueName("ev") } = {}) {
    const host = createActiveTagElement(env.document, { "at-name": name });
    env.document.body.appendChild(host);

    const calls = [];
    const { job } = await AT.runtime.createJob({
        name,
        e: host,
        def: {
            name,
            enabled: true,
            pipelines: {
                clicky: {
                    run: [
                        async ({ buffer, inputs }) => {
                            calls.push("start");
                            if (slowMs > 0) await sleep(slowMs);
                            buffer.set({
                                ok: true,
                                reason: inputs?.reason || null,
                            });
                            calls.push("end");
                            return true;
                        },
                    ],
                },
            },
            events: {
                click: {
                    event: "click",
                    pipeline: "clicky",
                },
            },
        },
        opts: {
            configure: "from",
            indexElement: true,
        },
    });

    assert.equal(job.config.status, "ready");
    return { job, host, calls };
}

test("events.register + on installs a tagged delegator handler", async () => {
    const { AT, env, delegator } = makeEventAT();
    const { job } = await createClickJob(AT, env);

    assert.equal(AT.events.register(job), 1);
    assert.equal(delegator.handlers.length, 0, "register must not install yet");

    assert.equal(AT.events.on(job), 1);
    assert.equal(delegator.handlers.length, 1);
    assert.equal(delegator.handlers[0].eventType, "click");
    assert.equal(delegator.handlers[0].tag, `at:event:${job.id}:click`);
    assert.equal(typeof delegator.handlers[0].handler, "function");

    // already on → no duplicate install
    assert.equal(AT.events.on(job), 0);
    assert.equal(delegator.handlers.length, 1);
});

test("event fire enqueues pipeline and drains when ticket is created", async () => {
    const { AT, env, delegator, hooks } = makeEventAT();
    const { job, host, calls } = await createClickJob(AT, env, { slowMs: 0 });

    AT.events.register(job);
    AT.events.on(job);

    delegator.fire("click", host);
    // handler schedules drain on microtask/promise
    await sleep(20);

    assert.deepEqual(calls, ["start", "end"]);
    assert.ok(hooks.of("enqueue").length >= 1);
    assert.ok(
        hooks.of("complete").length >= 1 || hooks.of("done").length >= 1,
        "expected terminal hook after event-driven drain"
    );
});

test("second event while ticket live does not double-step stages (returnMeta.created gate)", async () => {
    const { AT, env, delegator } = makeEventAT();
    const { job, host, calls } = await createClickJob(AT, env, { slowMs: 35 });

    AT.events.register(job);
    AT.events.on(job);

    // First fire starts a slow stage.
    delegator.fire("click", host);
    await sleep(5);

    // Second fire while first ticket still live — EventController must skip drain.
    delegator.fire("click", host);
    await sleep(60);

    assert.deepEqual(
        calls,
        ["start", "end"],
        "deduped event must not run the pipeline twice"
    );

    // After complete, a new fire should run again.
    delegator.fire("click", host);
    await sleep(60);
    assert.deepEqual(calls, ["start", "end", "start", "end"]);
});

test("events.remove uninstalls delegator handlers and dispose clears events", async () => {
    const { AT, env, delegator } = makeEventAT();
    const { job, host } = await createClickJob(AT, env);

    AT.events.register(job);
    AT.events.on(job);
    assert.equal(delegator.handlers.length, 1);

    AT.events.remove(job);
    assert.equal(delegator.handlers.length, 0);

    // Re-register + on works after remove.
    assert.equal(AT.events.register(job), 1);
    assert.equal(AT.events.on(job), 1);
    assert.equal(delegator.handlers.length, 1);

    // disposeJob should remove event bindings when runtimeDispose is enabled.
    assert.equal(AT.runtime.disposeJob(job), true);
    assert.equal(delegator.handlers.length, 0);
    assert.equal(AT.jobs.hasElement(host), false);
});

test("setupEventHandler is the public builder used by on() installs", async () => {
    const { AT, env } = makeEventAT();
    const { job, host, calls } = await createClickJob(AT, env);

    const handler = AT.events.setupEventHandler({
        job,
        eventName: "click",
        eventType: "click",
        pipeline: "clicky",
        rec: { event: "click", pipeline: "clicky" },
    });

    assert.equal(typeof handler, "function");
    handler.call(host, {
        type: "click",
        target: host,
        preventDefault() {},
        stopImmediatePropagation() {},
    });
    await sleep(20);
    assert.deepEqual(calls, ["start", "end"]);
});
