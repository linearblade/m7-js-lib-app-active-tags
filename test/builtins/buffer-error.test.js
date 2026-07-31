/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Builtins: buffer.* and error.capture smokes (direct + engine path).
 */

import test from "node:test";
import assert from "node:assert/strict";

import buffer from "../../src/builtins/buffer/index.js";
import ERROR from "../../src/builtins/error/index.js";
import { createAT, createHeadlessJob } from "../helpers/index.js";
import Buffer from "../../src/class/engine/Buffer.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test("buffer.set / get / clear operate on ticket buffer", async () => {
    const { AT, lib } = createAT();
    const { job } = await createHeadlessJob(AT, uniqueName("buf"), {
        pipelines: { default: { run: [() => true] } },
    });
    const ticket = { id: "t1", pipelineKey: "default", buffer: new Buffer(), inputs: {} };
    const buf = ticket.buffer;

    const setRes = await buffer.set({
        lib,
        buffer: buf,
        args: { value: { a: 1 }, meta: { source: "test" } },
        step: {},
    });
    assert.equal(setRes.status, "ok");
    assert.deepEqual(buf.get(), { a: 1 });
    assert.equal(buf.meta().source, "test");

    const getRes = await buffer.get({
        lib,
        expr: AT.expr,
        job,
        ticket,
        buffer: buf,
        args: { dst: "ws:copied" },
        step: {},
    });
    assert.equal(getRes.status, "ok");
    assert.deepEqual(job.ws.copied, { a: 1 });

    const clearRes = await buffer.clear({ buffer: buf, step: {} });
    assert.equal(clearRes.status, "ok");
    assert.equal(buf.get(), null);
});

test("engine path runs @buffer.set and @buffer.clear builtins", async () => {
    const { AT } = createAT();
    const { job } = await createHeadlessJob(AT, uniqueName("buf-eng"), {
        pipelines: {
            default: {
                run: [
                    "@buffer.set:value=from-dsl",
                    ({ buffer: b }) => {
                        // intermediate assert via function stage
                        if (b.get() !== "from-dsl") {
                            throw new Error(`expected dsl value, got ${JSON.stringify(b.get())}`);
                        }
                        return true;
                    },
                    "@buffer.clear",
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.equal(ticket.buffer.get(), null);
});

test("error.capture writes message to destination expression", async () => {
    const { AT, lib } = createAT();
    const { job } = await createHeadlessJob(AT, uniqueName("errcap"), {
        pipelines: { default: { run: [() => true] } },
    });
    const ticket = {
        id: "t-err",
        pipelineKey: "default",
        buffer: new Buffer(),
        errorInfo: { error: new Error("captured-boom"), detail: {} },
    };

    const res = await ERROR.capture({
        lib,
        expr: AT.expr,
        job,
        ticket,
        buffer: ticket.buffer,
        args: {
            which: "original",
            capture: "message",
            dst: "ws:errMsg",
        },
        step: {},
    });

    assert.equal(res.status, "ok");
    assert.equal(job.ws.errMsg, "captured-boom");
});

test("error pipeline can capture thrown run errors onto workspace", async () => {
    const { AT } = createAT();
    const { job } = await createHeadlessJob(AT, uniqueName("err-pipe"), {
        pipelines: {
            default: {
                run: [
                    () => {
                        throw new Error("pipe-boom");
                    },
                ],
                error: [
                    async ({ job: j, lib, expr, ticket, buffer, step }) => {
                        return ERROR.capture({
                            job: j,
                            lib,
                            expr,
                            ticket,
                            buffer,
                            args: {
                                which: "original",
                                capture: "message",
                                dst: "ws:lastError",
                            },
                            step,
                        });
                    },
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.match(String(job.ws.lastError || ""), /pipe-boom/);
});

test("error.fail returns falsy so VM scalar normalization treats stage as error", async () => {
    // Documented contract: return false (not SR_error) so OP coerces to error.
    assert.equal(ERROR.fail(), false);

    const { AT } = createAT();
    const { job } = await createHeadlessJob(AT, uniqueName("err-fail"), {
        pipelines: {
            default: {
                run: ["@error.fail"],
                error: [() => true],
            },
        },
    });
    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete", "error pipeline handles fail");
});