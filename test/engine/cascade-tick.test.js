/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Deterministic tick stepping + same-job multi-pipeline cascade.
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

test("tick advances exactly one stage at a time", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("tick"), {
        pipelines: {
            default: {
                run: [
                    ({ buffer }) => {
                        buffer.set({ s: 1 });
                        return true;
                    },
                    ({ buffer }) => {
                        buffer.set({ s: 2 });
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(ticket.cursor.stage, 0);

    const t1 = await AT.engine.tick({ ticket });
    assert.equal(t1.didWork, true);
    assert.equal(t1.ok, true);
    assert.equal(ticket.state, "running");
    assert.equal(ticket.cursor.stage, 1);
    assert.deepEqual(ticket.buffer.get(), { s: 1 });

    const t2 = await AT.engine.tick({ ticket });
    assert.equal(t2.didWork, true);
    assert.equal(ticket.cursor.stage, 2);
    assert.deepEqual(ticket.buffer.get(), { s: 2 });

    const t3 = await AT.engine.tick({ ticket });
    assert.equal(t3.didWork, true);
    assert.equal(t3.complete, true);
    assert.equal(ticket.state, "complete");

    const t4 = await AT.engine.tick({ ticket });
    assert.equal(t4.didWork, false, "completed ticket should not keep working");
});

test("two pipeline keys on the same job both run (cascade)", async () => {
    const { AT } = createAT();
    const order = [];

    const { job } = await createHeadlessJob(AT, uniqueName("cascade"), {
        pipelines: {
            a: {
                run: [
                    async () => {
                        order.push("a-start");
                        await sleep(10);
                        order.push("a-end");
                        return true;
                    },
                ],
            },
            b: {
                run: [
                    () => {
                        order.push("b");
                        return true;
                    },
                ],
            },
        },
    });

    const ta = AT.engine.enqueue(job, "a", { returnMeta: true });
    const tb = AT.engine.enqueue(job, "b", { returnMeta: true });
    assert.equal(ta.created, true);
    assert.equal(tb.created, true);
    assert.notEqual(ta.ticket.id, tb.ticket.id);

    const did = await AT.engine.drain({});
    assert.ok(did >= 2);
    assert.deepEqual(order, ["a-start", "a-end", "b"]);
    assert.equal(ta.ticket.state, "complete");
    assert.equal(tb.ticket.state, "complete");
});

test("getTicketByJob resolves live alias and clears after complete", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("by-job"), {
        pipelines: {
            default: {
                run: [
                    async () => {
                        await sleep(15);
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(AT.engine.getTicketByJob(job, "default")?.id, ticket.id);

    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.equal(AT.engine.getTicketByJob(job, "default"), null);
});

test("drain max bound stops stepping early", async () => {
    const { AT } = createAT();
    const calls = [];

    const { job } = await createHeadlessJob(AT, uniqueName("max"), {
        pipelines: {
            default: {
                run: [
                    () => {
                        calls.push(1);
                        return true;
                    },
                    () => {
                        calls.push(2);
                        return true;
                    },
                    () => {
                        calls.push(3);
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    const did = await AT.engine.drain({ ticket, max: 1 });
    assert.equal(did, 1);
    assert.deepEqual(calls, [1]);
    assert.notEqual(ticket.state, "complete");

    const did2 = await AT.engine.drain({ ticket, max: 10 });
    assert.ok(did2 >= 2);
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(ticket.state, "complete");
});
