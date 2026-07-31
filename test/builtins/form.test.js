/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * form.prepare / collect / toEnvelope / submit
 */

import test from "node:test";
import assert from "node:assert/strict";

import FORM from "../../src/builtins/form/index.js";
import {
    createAT,
    createDomEnv,
    createFakeForm,
    createHeadlessJob,
} from "../helpers/index.js";
import Buffer from "../../src/class/engine/Buffer.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeFormHarness() {
    const env = createDomEnv();
    const harness = createAT({ env }, { env });
    const fixture = createFakeForm(env.document, {
        action: "http://example.test/submit",
        method: "POST",
        fields: [
            { name: "user", value: "ada", type: "text" },
            { name: "note", value: "hello", type: "text" },
        ],
    });
    env.document.body.appendChild(fixture.form);
    return { ...harness, env, ...fixture };
}

test("form.prepare stages submitter onto ticket.trigger", async () => {
    const { lib, form, submitBtn } = makeFormHarness();
    const ticket = { trigger: null };
    const job = { e: form };

    const res = await FORM.prepare({
        job,
        lib,
        trigger: submitBtn,
        inputs: {},
        ticket,
        step: {},
    });

    assert.equal(res.status, "ok");
    assert.equal(ticket.trigger, submitBtn);
});

test("form.prepare prefers inputs.trigger override", async () => {
    const { lib, form, fields, submitBtn } = makeFormHarness();
    const ticket = { trigger: null };
    const job = { e: form };

    const res = await FORM.prepare({
        job,
        lib,
        trigger: submitBtn,
        inputs: { trigger: fields[0] },
        ticket,
        step: {},
    });

    assert.equal(res.status, "ok");
    assert.equal(ticket.trigger, fields[0]);
});

test("form.collect writes collected parms onto buffer", async () => {
    const { lib, form, fields } = makeFormHarness();
    const buffer = new Buffer();
    const job = { e: form };

    const res = await FORM.collect({
        job,
        lib,
        trigger: fields[0],
        buffer,
        step: {},
    });

    assert.equal(res.status, "ok");
    const data = buffer.get();
    assert.ok(data?.form);
    assert.ok(Array.isArray(data.parms));
    const map = Object.fromEntries(data.parms);
    assert.equal(map.user, "ada");
    assert.equal(map.note, "hello");
    assert.equal(String(data.method || "").toUpperCase(), "POST");
    assert.equal(data.url, "http://example.test/submit");
});

test("form.toEnvelope builds request envelope from collected buffer", async () => {
    const { lib, form, fields } = makeFormHarness();
    const buffer = new Buffer();
    const job = { e: form, ws: {} };

    await FORM.collect({ job, lib, trigger: fields[0], buffer, step: {} });
    const res = await FORM.toEnvelope({
        job,
        lib,
        trigger: fields[0],
        buffer,
        args: {
            method: "POST",
            contentType: "urlencoded",
        },
        step: {},
    });

    assert.equal(res.status, "ok");
    const envelope = buffer.get();
    assert.equal(envelope.method, "POST");
    assert.ok(envelope.body);
    assert.match(String(envelope.body), /user=ada/);
    assert.ok(envelope.headers);
    assert.ok(envelope.endpoint?.url || envelope.url);
});

test("form.submit uses collect buffer and lib.dom.form.submit", async () => {
    const { lib, form, fields } = makeFormHarness();
    const buffer = new Buffer();
    const job = { e: form, transactions: {} };

    const collected = lib.dom.form.collect(fields[0]);
    buffer.set(collected);

    const calls = [];
    const original = lib.dom.form.submit;
    lib.dom.form.submit = async (src, opts) => {
        calls.push({ src, opts });
        return { ok: true, status: 201, body: { id: 9 } };
    };

    try {
        const res = await FORM.submit({
            job,
            lib,
            trigger: fields[0],
            buffer,
            args: {},
            step: {},
        });
        assert.equal(res.status, "ok");
        assert.equal(calls.length, 1);
        assert.deepEqual(buffer.get(), { ok: true, status: 201, body: { id: 9 } });
    } finally {
        lib.dom.form.submit = original;
    }
});

test("form.collect errors when trigger is not a form source", async () => {
    const { lib, env } = makeFormHarness();
    const lone = env.document.createElement("div");
    const buffer = new Buffer();
    const res = await FORM.collect({
        job: { e: lone },
        lib,
        trigger: lone,
        buffer,
        step: {},
    });
    // collect returns undefined without a form ancestor → invalid form context error
    assert.equal(res.status, "error");
});

test("engine path: form.collect then form.toEnvelope", async () => {
    const env = createDomEnv();
    const { AT, lib } = createAT({ env }, { env });
    const { form, fields } = createFakeForm(env.document);
    env.document.body.appendChild(form);

    const name = uniqueName("form-eng");
    const { job } = await AT.runtime.createJob({
        name,
        e: form,
        def: {
            name,
            enabled: true,
            pipelines: {
                default: {
                    run: [
                        async (ctx) =>
                            FORM.collect({
                                ...ctx,
                                trigger: fields[0],
                            }),
                        async (ctx) =>
                            FORM.toEnvelope({
                                ...ctx,
                                trigger: fields[0],
                                args: { method: "POST", contentType: "json" },
                            }),
                    ],
                },
            },
        },
        opts: { configure: "from", indexElement: true },
    });

    const { ticket } = AT.engine.enqueue(job, "default", {
        returnMeta: true,
        inputs: {},
    });
    // pass trigger through ticket for stages that read ctx.trigger - our stages close over fields
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    const envelope = ticket.buffer.get();
    assert.equal(envelope.method, "POST");
    assert.ok(envelope.body);
});
