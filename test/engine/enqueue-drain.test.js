/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Engine spine regression pack:
 * - happy-path drain
 * - enqueue dedupe + returnMeta
 * - re-entrant concurrent drain (no double-step)
 * - wait park / resume with preserved buffer
 * - error pipeline recovery
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

test("enqueue + drain completes a multi-stage headless pipeline", async () => {
    const { AT, hooks } = createAT();
    const name = uniqueName("happy");

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            default: {
                run: [
                    ({ buffer }) => {
                        buffer.set({ n: 1 }, { source: "stage1" });
                        return true;
                    },
                    ({ buffer }) => {
                        const cur = buffer.get() || {};
                        buffer.set({ n: (Number(cur.n) || 0) + 1 }, { source: "stage2" });
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket, created } = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(created, true);
    assert.ok(ticket?.id);
    assert.equal(ticket.state, "ready");

    const did = await AT.engine.drain({ ticket });
    assert.ok(did >= 2, `expected at least 2 ticks of work, got ${did}`);
    assert.equal(ticket.state, "complete");
    assert.deepEqual(ticket.buffer.get(), { n: 2 });

    const enqueues = hooks.of("enqueue");
    assert.equal(enqueues.length, 1);
    assert.equal(enqueues[0].ticketId, ticket.id);

    const stages = hooks.of("stage");
    assert.ok(
        stages.some((s) => s.status === "ok" || s.ok),
        "expected ok stage hook(s)"
    );
    assert.ok(hooks.of("complete").length >= 1, "expected onComplete terminal hook");
    assert.ok(hooks.of("done").length >= 1, "expected onTicketDone terminal hook");
});

test("enqueue dedupes same job + pipelineKey and returnMeta.created is false on hit", async () => {
    const { AT, hooks } = createAT();
    const name = uniqueName("dedupe");

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            nav_link: {
                run: [
                    async () => {
                        // keep ticket live long enough for second enqueue
                        await sleep(15);
                        return true;
                    },
                ],
            },
        },
    });

    const first = AT.engine.enqueue(job, "nav_link", { returnMeta: true });
    assert.equal(first.created, true);

    const second = AT.engine.enqueue(job, "nav_link", { returnMeta: true });
    assert.equal(second.created, false);
    assert.equal(second.ticket.id, first.ticket.id);

    // Without returnMeta, still returns the same live ticket object.
    const bare = AT.engine.enqueue(job, "nav_link");
    assert.equal(bare.id, first.ticket.id);

    assert.equal(hooks.of("enqueue").length, 1, "dedupe must not re-fire onEnqueue");

    await AT.engine.drain({ ticket: first.ticket });
    assert.equal(first.ticket.state, "complete");

    // After terminal completion, alias clears — a new enqueue may create again.
    const third = AT.engine.enqueue(job, "nav_link", { returnMeta: true });
    assert.equal(third.created, true);
    assert.notEqual(third.ticket.id, first.ticket.id);
    await AT.engine.drain({ ticket: third.ticket });
});

test("concurrent drain on same live ticket does not double-step stages", async () => {
    const { AT } = createAT();
    const name = uniqueName("reenter");
    const calls = [];

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            default: {
                run: [
                    async () => {
                        calls.push("a-start");
                        await sleep(25);
                        calls.push("a-end");
                        return true;
                    },
                    () => {
                        calls.push("b");
                        return true;
                    },
                    ({ buffer }) => {
                        buffer.set({ ok: true }, { source: "final" });
                        calls.push("c");
                        return true;
                    },
                ],
            },
        },
    });

    const first = AT.engine.enqueue(job, "default", { returnMeta: true });
    const second = AT.engine.enqueue(job, "default", { returnMeta: true });
    assert.equal(second.created, false);
    assert.equal(first.ticket.id, second.ticket.id);

    // Mirror the cold-load failure mode: two drains race the same ticket.
    const p1 = AT.engine.drain({ ticket: first.ticket });
    const p2 = AT.engine.drain({ ticket: second.ticket });
    const [did1, did2] = await Promise.all([p1, p2]);

    assert.equal(first.ticket.state, "complete");
    assert.deepEqual(calls, ["a-start", "a-end", "b", "c"]);
    assert.deepEqual(first.ticket.buffer.get(), { ok: true });

    // One drain does the work; the other is a no-op (or near no-op) because of
    // the per-ticket stepping guard and/or empty runnable state.
    const total = did1 + did2;
    assert.ok(total >= 3, `expected combined work ticks >= 3, got ${total} (${did1}+${did2})`);
    assert.ok(
        did1 === 0 || did2 === 0,
        `expected one drain to be idle, got did1=${did1} did2=${did2}`
    );
});

test("wait parks ticket, preserves buffer, and resumes after lock expiry", async () => {
    const { AT } = createAT();
    const name = uniqueName("wait");
    const calls = [];
    let waitPasses = 0;

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            default: {
                run: [
                    ({ buffer }) => {
                        buffer.set({ token: "seed", n: 1 }, { source: "pre-wait" });
                        calls.push("pre");
                        return true;
                    },
                    // Wait stages re-run until they return ok (cursor does not advance on wait).
                    () => {
                        waitPasses += 1;
                        calls.push(`wait-${waitPasses}`);
                        if (waitPasses === 1) {
                            return {
                                status: "wait",
                                await: {
                                    type: "wait",
                                    until: Date.now() + 20,
                                },
                            };
                        }
                        return true;
                    },
                    ({ buffer }) => {
                        const cur = buffer.get() || {};
                        buffer.set(
                            { token: cur.token, n: (Number(cur.n) || 0) + 1 },
                            { source: "post-wait" }
                        );
                        calls.push("post");
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });

    const did1 = await AT.engine.drain({ ticket });
    assert.ok(did1 >= 2, `expected work before/at wait, got ${did1}`);
    assert.equal(ticket.state, "wait");
    assert.ok(ticket.lock?.until, "wait should install lock.until");
    assert.deepEqual(ticket.buffer.get(), { token: "seed", n: 1 });
    assert.deepEqual(calls, ["pre", "wait-1"]);

    // Wait for timed lock to expire, then pulse (drain + wake requeue).
    await sleep(35);
    const did2 = await AT.engine.pulse({ ticket });
    assert.ok(did2 >= 1, `expected resume work, got ${did2}`);
    assert.equal(ticket.state, "complete");
    assert.deepEqual(ticket.buffer.get(), { token: "seed", n: 2 });
    assert.deepEqual(calls, ["pre", "wait-1", "wait-2", "post"]);
});

test("run-stage throw routes to error pipeline and terminates", async () => {
    const { AT, hooks } = createAT();
    const name = uniqueName("err");
    const handled = [];

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            default: {
                run: [
                    () => {
                        throw new Error("boom-from-run");
                    },
                ],
                error: [
                    ({ ticket: t }) => {
                        // Error is attached to ticket.errorInfo, not a top-level `error` arg.
                        const msg =
                            t?.errorInfo?.error?.message ||
                            t?.errorInfo?.error ||
                            "missing-errorInfo";
                        handled.push(String(msg));
                        return true;
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    const did = await AT.engine.drain({ ticket });
    assert.ok(did >= 1);
    assert.equal(ticket.state, "complete", "error pipeline success completes the ticket");
    assert.equal(handled.length, 1);
    assert.match(handled[0], /boom-from-run/);

    assert.ok(hooks.of("stage").length >= 1);
    assert.ok(hooks.of("complete").length >= 1, "expected terminal complete after handled error pipeline");
});

test("hard error without error pipeline terminates as error", async () => {
    const { AT, hooks } = createAT();
    const name = uniqueName("hard-err");

    const { job } = await createHeadlessJob(AT, name, {
        pipelines: {
            default: {
                run: [
                    () => {
                        throw new Error("unhandled-boom");
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "error");

    const errors = hooks.of("error");
    assert.ok(errors.length >= 1, "expected onError hook");
    assert.match(String(errors[0].message || ""), /unhandled-boom/);
    assert.ok(hooks.of("done").length >= 1, "expected onTicketDone after terminal error");
    assert.ok(
        hooks.of("stage").some((s) => s.status === "error" || s.error),
        "expected error stage hook"
    );
});
