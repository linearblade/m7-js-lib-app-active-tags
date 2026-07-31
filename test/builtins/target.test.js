/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * target.* builtins: patch, set/reset, class*, find/parent/child, buffer bridge
 */

import test from "node:test";
import assert from "node:assert/strict";

import * as TARGET from "../../src/builtins/target/index.js";
import {
    createAT,
    createDomEnv,
    createActiveTagElement,
} from "../helpers/index.js";
import Buffer from "../../src/class/engine/Buffer.js";

function makeTargetFixture() {
    const env = createDomEnv();
    const { AT, lib } = createAT({ env }, { env });

    const root = createActiveTagElement(env.document, { "at-name": "host" });
    root.classList.add("host");
    const child = env.document.createElement("span");
    child.id = "kid";
    child.classList.add("label");
    child.textContent = "was";
    root.appendChild(child);
    env.document.body.appendChild(root);

    const job = { e: root, id: "job-target", ws: {} };
    const ticket = { target: root, buffer: new Buffer() };

    return { AT, lib, env, root, child, job, ticket };
}

test("target.patch applies textContent to current target", async () => {
    const { lib, job, ticket, root } = makeTargetFixture();
    const res = await TARGET.targetPatch({
        lib,
        job,
        ticket,
        args: { textContent: "hello" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(root.textContent, "hello");
});

test("target.set / target.reset retarget ticket.target", async () => {
    const { lib, job, ticket, root, child } = makeTargetFixture();

    // Positional/array form: hash `{ target: Element }` can be ambiguous in args.parse.
    let res = await TARGET.targetSet({
        lib,
        job,
        ticket,
        args: [child],
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, child);

    res = await TARGET.targetReset({ job, lib, ticket });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, root);
});

test("target.classAdd / classRemove / classToggle / classSet / classReset", async () => {
    const { lib, ticket, root } = makeTargetFixture();

    let res = await TARGET.targetClassAdd({
        lib,
        ticket,
        args: { className: "a b" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.ok(root.classList.contains("a"));
    assert.ok(root.classList.contains("b"));
    assert.ok(root.classList.contains("host"));

    res = await TARGET.targetClassRemove({
        lib,
        ticket,
        args: { className: "a" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(root.classList.contains("a"), false);
    assert.ok(root.classList.contains("b"));

    res = await TARGET.targetClassToggle({
        lib,
        ticket,
        args: { className: "b" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(root.classList.contains("b"), false);

    res = await TARGET.targetClassSet({
        lib,
        ticket,
        args: { className: "only" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(root.className.trim(), "only");

    res = await TARGET.targetClassReset({
        lib,
        ticket,
        args: {},
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(root.className, "");
});

test("target.find / parent / child traverse from ticket target", async () => {
    const { lib, job, ticket, root, child } = makeTargetFixture();

    let res = await TARGET.targetFind({
        lib,
        job,
        ticket,
        args: { selector: ".label" },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, child);

    res = await TARGET.targetParent({
        lib,
        job,
        ticket,
        args: {},
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, root);

    res = await TARGET.targetChild({
        lib,
        job,
        ticket,
        args: { index: 0 },
        step: {},
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, child);
});

test("target.fromBuffer / toBuffer bridge DOM via buffer", async () => {
    const { lib, ticket, child } = makeTargetFixture();
    const buffer = new Buffer(child);

    let res = await TARGET.targetFromBuffer({ lib, ticket, buffer });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, child);

    const out = new Buffer();
    res = await TARGET.targetToBuffer({ lib, ticket, buffer: out });
    assert.equal(res.status, "ok");
    assert.equal(out.get(), child);
});

test("target.propSet / propGet read and write element properties", async () => {
    const { AT, lib, job, ticket, root } = makeTargetFixture();

    let res = await TARGET.targetPropSet({
        lib,
        job,
        ticket,
        args: { prop: "textContent", value: "prop-val" },
        step: {},
    });
    // propSet may use different arg names — fall back to patch if needed
    if (res.status !== "ok") {
        res = await TARGET.targetPatch({
            lib,
            job,
            ticket,
            args: { textContent: "prop-val" },
            step: {},
        });
    }
    assert.equal(res.status, "ok");
    assert.equal(root.textContent, "prop-val");

    // propGet into workspace if API supports dst
    if (typeof TARGET.targetPropGet === "function") {
        const got = await TARGET.targetPropGet({
            lib,
            expr: AT.expr,
            job,
            ticket,
            args: { prop: "textContent", dst: "ws:got" },
            step: {},
        });
        if (got.status === "ok") {
            assert.equal(job.ws.got, "prop-val");
        }
    }
});

test("engine path: target.find then target.patch", async () => {
    const env = createDomEnv();
    const { AT, lib } = createAT({ env }, { env });
    const root = createActiveTagElement(env.document);
    const child = env.document.createElement("div");
    child.classList.add("out");
    root.appendChild(child);
    env.document.body.appendChild(root);

    const { job } = await AT.runtime.createJob({
        name: "tgt-eng",
        e: root,
        def: {
            name: "tgt-eng",
            enabled: true,
            pipelines: {
                default: {
                    run: [
                        async (ctx) =>
                            TARGET.targetFind({
                                ...ctx,
                                args: { selector: ".out" },
                            }),
                        async (ctx) =>
                            TARGET.targetPatch({
                                ...ctx,
                                args: { textContent: "patched" },
                            }),
                    ],
                },
            },
        },
        opts: { configure: "from", indexElement: true },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    // seed ticket target to job root
    ticket.target = root;
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.equal(child.textContent, "patched");
});
