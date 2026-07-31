/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Job schema compiler (Master) normalization contracts.
 * Master prefers coercion over hard failure — tests document that posture.
 */

import test from "node:test";
import assert from "node:assert/strict";

import Master from "../../src/class/job/config/schema/Master.js";
import { createAT } from "../helpers/index.js";

function compiler() {
    const { AT, lib } = createAT();
    return {
        AT,
        lib,
        master: new Master({ lib, expr: AT.expr }),
    };
}

test("compile normalizes pipelines, events, intervals, and requests", () => {
    const { master } = compiler();
    const { report, schema } = master.compile({
        name: "full-job",
        enabled: true,
        pipelines: {
            default: {
                run: [() => true],
                error: ["@error.dump"],
            },
            other: {
                run: [() => true],
            },
        },
        events: {
            click: { event: "click", pipeline: "default" },
        },
        intervals: {
            tick: { repeat: 1000, pipeline: "other" },
        },
        requests: {
            ping: {
                transport: "http",
                endpoint: { url: "http://example.test/ping" },
                method: "GET",
            },
        },
    });

    assert.equal(report.ok, true);
    assert.equal(schema.name, "full-job");
    assert.ok(schema.pipelines.default);
    assert.ok(schema.pipelines.other);
    assert.equal(schema.pipelines.default.error[0].op, "error.dump");
    assert.equal(schema.pipelines.default.error[0].builtin, true);
    assert.equal(schema.events.click.event, "click");
    assert.equal(schema.events.click.pipeline, "default");
    assert.equal(schema.intervals.tick.repeat, 1000);
    assert.equal(schema.intervals.tick.pipeline, "other");
    assert.equal(schema.requests.ping.endpoint.url, "http://example.test/ping");
});

test("single pipeline/request/interval/event forms map into default buckets", () => {
    const { master } = compiler();
    const { report, schema } = master.compile({
        name: "single",
        pipeline: { run: [() => true] },
        request: {
            endpoint: { url: "/only" },
            method: "post",
        },
        interval: { repeat: 250, pipeline: "default" },
        event: { event: "submit", pipeline: "default" },
    });

    assert.equal(report.ok, true);
    assert.ok(schema.pipelines.default);
    assert.equal(schema.requests.default.method, "post");
    assert.equal(schema.requests.default.endpoint.url, "/only");
    assert.equal(schema.intervals.default.repeat, 250);
    assert.equal(schema.events.default.event, "submit");
});

test("DSL op strings become builtin step records", () => {
    const { master } = compiler();
    const { report, schema } = master.compile({
        name: "dsl",
        pipelines: {
            default: {
                run: [
                    "@buffer.set:value=hello",
                    "@buffer.clear",
                    "@error.dump",
                ],
            },
        },
    });

    assert.equal(report.ok, true);
    const steps = schema.pipelines.default.run;
    assert.equal(steps.length, 3);
    assert.equal(steps[0].op, "buffer.set");
    assert.equal(steps[0].builtin, true);
    assert.equal(steps[0].kv.value, "hello");
    assert.equal(steps[1].op, "buffer.clear");
    assert.equal(steps[2].op, "error.dump");
});

test("literal functions remain non-builtin pipeline steps", () => {
    const { master } = compiler();
    const fn = function stageFn() {
        return true;
    };
    const { schema } = master.compile({
        name: "fn",
        pipelines: {
            default: {
                run: [fn],
            },
        },
    });

    const step = schema.pipelines.default.run[0];
    assert.equal(step.builtin, false);
    assert.equal(typeof step.op === "function" || typeof step.raw === "function", true);
});

test("compiler coerces sparse input without throwing", () => {
    const { master } = compiler();
    const { report, schema } = master.compile({});
    assert.equal(report.ok, true);
    assert.equal(typeof schema, "object");
    assert.ok(schema.pipelines);
    assert.ok(schema.events);
    assert.ok(schema.intervals);
    assert.ok(schema.requests);
});

test("named + singular blocks coexist in buckets", () => {
    const { master } = compiler();
    const { schema } = master.compile({
        name: "mix",
        pipeline: { run: [() => true] },
        pipelines: {
            extra: { run: [() => true] },
        },
        interval: { repeat: 10, pipeline: "default" },
        intervals: {
            named: { repeat: 20, pipeline: "extra" },
        },
    });

    assert.ok(schema.pipelines.default);
    assert.ok(schema.pipelines.extra);
    assert.equal(schema.intervals.default.repeat, 10);
    assert.equal(schema.intervals.named.repeat, 20);
});
