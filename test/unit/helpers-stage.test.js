/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * StageResult helper vocabulary (pure).
 */

import test from "node:test";
import assert from "node:assert/strict";

import helpers from "../../src/class/engine/helpers.js";

test("STAGE_STATUS / TICKET_STATE vocabulary is stable", () => {
    assert.deepEqual(helpers.STAGE_STATUS_RANGE, ["ok", "wait", "error", "complete"]);
    assert.equal(helpers.STAGE_STATUS.OK, "ok");
    assert.equal(helpers.STAGE_STATUS.WAIT, "wait");
    assert.equal(helpers.STAGE_STATUS.ERROR, "error");
    assert.equal(helpers.STAGE_STATUS.COMPLETE, "complete");

    assert.equal(helpers.TICKET_STATE.READY, "ready");
    assert.equal(helpers.TICKET_STATE.RUNNING, "running");
    assert.equal(helpers.TICKET_STATE.WAIT, "wait");
    assert.equal(helpers.TICKET_STATE.ERROR, "error");
    assert.equal(helpers.TICKET_STATE.COMPLETE, "complete");
});

test("SR_* constructors shape results", () => {
    assert.deepEqual(helpers.SR_ok({ n: 1 }), { status: "ok", detail: { n: 1 } });
    assert.equal(helpers.SR_wait({ until: 1 }).status, "wait");
    assert.equal(helpers.SR_wait({ until: 1 }).await.until, 1);
    assert.equal(helpers.SR_error(new Error("x")).status, "error");
    assert.equal(helpers.SR_error(new Error("x")).error.message, "x");
    assert.equal(helpers.SR_complete().status, "complete");
});

test("makeRunTicket builds a ready ticket with buffer and cursor", () => {
    const job = {
        id: "job-x",
        e: null,
        lib: {
            hash: {
                get() {
                    return [];
                },
            },
        },
    };

    const ticket = helpers.makeRunTicket({
        job,
        pipelineKey: "nav",
        inputs: { a: 1 },
        priority: 2,
        meta: { source: "unit" },
    });

    assert.ok(ticket.id.startsWith("rt_"));
    assert.equal(ticket.jobId, "job-x");
    assert.equal(ticket.pipelineKey, "nav");
    assert.equal(ticket.state, "ready");
    assert.equal(ticket.priority, 2);
    assert.deepEqual(ticket.inputs, { a: 1 });
    assert.deepEqual(ticket.meta, { source: "unit" });
    assert.equal(ticket.cursor.stage, 0);
    assert.ok(ticket.buffer);
    assert.equal(typeof ticket.buffer.get, "function");
    assert.equal(ticket.buffer.get(), null);
});
