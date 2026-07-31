/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Ticket inputs handoff + per-job workspace persistence across runs.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createAT, createHeadlessJob } from "../helpers/index.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test("enqueue inputs are visible to stages via ticket.inputs", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("inputs"), {
        pipelines: {
            default: {
                run: [
                    ({ inputs, buffer }) => {
                        buffer.set({
                            msg: inputs?.msg ?? null,
                            n: inputs?.n ?? null,
                        });
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", {
        returnMeta: true,
        inputs: { msg: "hello", n: 3 },
        meta: { source: "test" },
    });

    assert.equal(ticket.inputs.msg, "hello");
    assert.equal(ticket.meta?.source, "test");

    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.deepEqual(ticket.buffer.get(), { msg: "hello", n: 3 });
});

test("job.ws persists across successive tickets on the same job", async () => {
    const { AT } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("ws"), {
        pipelines: {
            default: {
                run: [
                    ({ job: j, lib, buffer }) => {
                        const n = Number(lib.hash.get(j.ws, "n") || 0) + 1;
                        lib.hash.set(j.ws, "n", n);
                        buffer.set({ n });
                        return true;
                    },
                ],
            },
        },
    });

    const t1 = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket: t1.ticket });
    assert.deepEqual(t1.ticket.buffer.get(), { n: 1 });
    assert.equal(job.ws.n, 1);

    const t2 = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.notEqual(t2.ticket.id, t1.ticket.id);
    await AT.engine.drain({ ticket: t2.ticket });
    assert.deepEqual(t2.ticket.buffer.get(), { n: 2 });
    assert.equal(job.ws.n, 2);
});

test("falsy stage return becomes stage error (no implicit continue)", async () => {
    const { AT, hooks } = createAT();

    const { job } = await createHeadlessJob(AT, uniqueName("falsy"), {
        pipelines: {
            default: {
                run: [
                    () => false,
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "error");
    assert.ok(hooks.of("error").length >= 1);
});

test("status complete short-circuits remaining stages", async () => {
    const { AT } = createAT();
    const calls = [];

    const { job } = await createHeadlessJob(AT, uniqueName("early-complete"), {
        pipelines: {
            default: {
                run: [
                    () => {
                        calls.push("a");
                        return { status: "complete" };
                    },
                    () => {
                        calls.push("b");
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.deepEqual(calls, ["a"]);
});
