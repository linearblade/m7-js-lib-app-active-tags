/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * ExpressionResolver path resolution against a real headless Job context.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createAT, createHeadlessJob } from "../helpers/index.js";
import Buffer from "../../src/class/engine/Buffer.js";

async function makeJobCtx(AT) {
    const { job } = await createHeadlessJob(AT, `expr-${Date.now().toString(36)}`, {
        pipelines: {
            default: {
                run: [() => true],
            },
        },
    });

    job.ws.counter = 7;
    job.ws.path = { deep: "yes" };

    const buffer = new Buffer({ a: 42, nested: { z: 1 } });
    const ticket = {
        id: "rt_test",
        pipelineKey: "default",
        buffer,
        inputs: { x: 9 },
        target: null,
    };

    return {
        job,
        ticket,
        lib: AT.lib,
        env: AT.conf.env,
        ctx: { local: "ctx-value" },
        buffer,
    };
}

test("ExpressionResolver resolves job / ws / buffer / ticket / config paths", async () => {
    const { AT } = createAT();
    const ctx = await makeJobCtx(AT);

    assert.equal(AT.expr.eval(ctx, "job:id"), ctx.job.id);
    assert.equal(AT.expr.eval(ctx, "job:name"), ctx.job.name);
    assert.equal(AT.expr.eval(ctx, "ws:counter"), 7);
    assert.equal(AT.expr.eval(ctx, "ws:path.deep"), "yes");
    assert.equal(AT.expr.eval(ctx, "buffer:a"), 42);
    assert.equal(AT.expr.eval(ctx, "buffer:nested.z"), 1);
    assert.equal(AT.expr.eval(ctx, "ticket:pipelineKey"), "default");
    assert.equal(AT.expr.eval(ctx, "ticket:id"), "rt_test");
    assert.equal(AT.expr.eval(ctx, "config:name"), ctx.job.name);
    assert.equal(AT.expr.eval(ctx, "ctx:local"), "ctx-value");
});

test("unknown expression types resolve to undefined", async () => {
    const { AT } = createAT();
    const ctx = await makeJobCtx(AT);
    assert.equal(AT.expr.eval(ctx, "nope:thing"), undefined);
    assert.equal(AT.expr.eval(ctx, "buffer:missing.path"), undefined);
});

test("parse returns reference objects for property targets", async () => {
    const { AT } = createAT();
    const ctx = await makeJobCtx(AT);
    const ref = AT.expr.parse(ctx, "job:id");
    assert.ok(ref && typeof ref === "object");
    assert.equal(ref.prop, "id");
    assert.equal(ref.src?.id, ctx.job.id);
});

test("buffer without locator returns whole buffer value", async () => {
    const { AT } = createAT();
    const ctx = await makeJobCtx(AT);
    assert.deepEqual(AT.expr.eval(ctx, "buffer:"), { a: 42, nested: { z: 1 } });
});
