/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Cancel + lock policy for EngineManager / Tick.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createAT, createHeadlessJob } from "../helpers/index.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("cancelTicket removes a queued ticket before it runs", async () => {
    const { AT } = createAT();
    const calls = [];

    const { job } = await createHeadlessJob(AT, uniqueName("cancel-queued"), {
        pipelines: {
            default: {
                run: [
                    () => {
                        calls.push("ran");
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket, created } = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(created, true);
    assert.equal(AT.engine.cancelTicket(ticket.id), 1);
    assert.equal(AT.engine.state.getTicket(ticket.id), null);

    const did = await AT.engine.drain({ ticket });
    assert.equal(did, 0);
    assert.deepEqual(calls, []);

    // Alias cleared — a later enqueue can create a fresh ticket.
    const again = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(again.created, true);
    assert.notEqual(again.ticket.id, ticket.id);
    await AT.engine.drain({ ticket: again.ticket });
    assert.deepEqual(calls, ["ran"]);
});

test("cancel while active marks ticket error and drops it from the index", async () => {
    const { AT } = createAT();
    const calls = [];

    const { job } = await createHeadlessJob(AT, uniqueName("cancel-active"), {
        pipelines: {
            default: {
                run: [
                    async () => {
                        calls.push("start");
                        await sleep(40);
                        calls.push("end");
                        return true;
                    },
                    () => {
                        calls.push("second");
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    const drainP = AT.engine.drain({ ticket });
    await sleep(5);

    assert.equal(AT.engine.cancel(job, "default"), 1);
    assert.equal(ticket.state, "error");

    const did = await drainP;
    assert.ok(did >= 1);
    assert.equal(AT.engine.state.getTicket(ticket.id), null);
    // Second stage must not run after cancel; first may finish its in-flight step.
    assert.ok(!calls.includes("second"), `second stage should not run: ${JSON.stringify(calls)}`);
});

test("lockTicket blocks drain; unlockTicket with token resumes", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("lock"), {
        pipelines: {
            default: {
                run: [
                    ({ buffer }) => {
                        buffer.set({ n: 1 });
                        return true;
                    },
                    ({ buffer }) => {
                        buffer.set({ n: 2 });
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(
        AT.engine.lockTicket(ticket.id, { type: "test", token: "tok-1" }),
        1
    );
    assert.equal(ticket.lock?.token, "tok-1");

    const blocked = await AT.engine.drain({ ticket });
    assert.equal(blocked, 0);
    assert.equal(ticket.state, "ready");
    assert.equal(ticket.buffer.get(), null);

    assert.equal(AT.engine.unlockTicket(ticket.id, "wrong-token"), 0, "token mismatch");
    assert.equal(ticket.lock?.token, "tok-1");

    assert.equal(AT.engine.unlockTicket(ticket.id, "tok-1"), 1);
    assert.equal(ticket.lock, null);

    const did = await AT.engine.drain({ ticket });
    assert.ok(did >= 2);
    assert.equal(ticket.state, "complete");
    assert.deepEqual(ticket.buffer.get(), { n: 2 });
});

test("lock before enqueue is a no-op (alias has no ticket yet)", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("lock-early"), {
        pipelines: {
            default: {
                run: [() => true],
            },
        },
    });

    assert.equal(AT.engine.lock(job, "default"), 0);

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    const did = await AT.engine.drain({ ticket });
    assert.ok(did >= 1);
    assert.equal(ticket.state, "complete");
});

test("cancel of unknown ticket id is a no-op", async () => {
    const { AT } = createAT();
    assert.equal(AT.engine.cancelTicket("rt_does_not_exist"), 0);
});
