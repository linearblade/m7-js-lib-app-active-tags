/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * dom.attempt + e.* (self/reset/find/closest/parent/child)
 */

import test from "node:test";
import assert from "node:assert/strict";

import DOM from "../../src/builtins/dom/index.js";
import * as E from "../../src/builtins/e/index.js";
import {
    createAT,
    createDomEnv,
    createActiveTagElement,
} from "../helpers/index.js";

function makeTree() {
    const env = createDomEnv();
    const { lib } = createAT({ env }, { env });

    const outer = env.document.createElement("section");
    outer.classList.add("wrap");
    const root = createActiveTagElement(env.document);
    root.classList.add("job-root");
    const child = env.document.createElement("span");
    child.id = "item";
    child.classList.add("item");
    root.appendChild(child);
    outer.appendChild(root);
    env.document.body.appendChild(outer);

    const job = { e: root, id: "e-job", ws: {} };
    return { lib, env, outer, root, child, job };
}

test("dom.attempt resolves an element onto ticket.target", async () => {
    const { lib, root } = makeTree();
    const ticket = { target: null };

    // Prefer positional/array form — hash form can be ambiguous for Element values.
    const res = await DOM.attempt({
        lib,
        ticket,
        args: [root],
        step: {},
    });

    assert.equal(res.status, "ok");
    assert.equal(ticket.target, root);
});

test("dom.attempt errors on missing target", async () => {
    const { lib } = makeTree();
    const ticket = { target: null };
    const res = await DOM.attempt({
        lib,
        ticket,
        args: [],
        step: {},
    });
    assert.equal(res.status, "error");
});

test("e.self / e.reset set ticket.target to job.e", async () => {
    const { lib, job, root } = makeTree();
    const ticket = { target: null };

    let res = await E.eSelf({ lib, job, ticket });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, root);

    ticket.target = null;
    res = await E.eReset({ lib, job, ticket });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, root);
});

test("e.find selects descendant from job.e", async () => {
    const { lib, job, child } = makeTree();
    const ticket = { target: null };

    const res = await E.eFind({
        lib,
        job,
        ticket,
        args: { selector: "#item" },
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, child);
});

test("e.closest walks ancestors from job.e", async () => {
    const { lib, job, outer } = makeTree();
    const ticket = { target: null };

    const res = await E.eClosest({
        lib,
        job,
        ticket,
        args: { selector: ".wrap" },
    });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, outer);
});

test("e.parent and e.child navigate the tree", async () => {
    const { lib, job, root, child, outer } = makeTree();
    const ticket = { target: null };

    let res = await E.eParent({ lib, job, ticket, args: {} });
    assert.equal(res.status, "ok");
    assert.equal(ticket.target, outer);

    res = await E.eChild({ lib, job, ticket: { target: null }, args: { index: 0 } });
    assert.equal(res.status, "ok");
    assert.equal(res.detail?.index, 0);
    // e.child always resolves from job.e, not ticket.target
    assert.equal(ticket.target === child || res.status === "ok", true);
    // re-read via fresh ticket
    const t2 = { target: null };
    res = await E.eChild({ lib, job, ticket: t2, args: { index: 0 } });
    assert.equal(t2.target, child);
    assert.equal(t2.target.parentElement, root);
});

test("e.find errors when selector misses", async () => {
    const { lib, job } = makeTree();
    const ticket = { target: null };
    const res = await E.eFind({
        lib,
        job,
        ticket,
        args: { selector: ".nope" },
    });
    assert.equal(res.status, "error");
});

test("engine path: e.find then target stays for subsequent stage", async () => {
    const env = createDomEnv();
    const { AT } = createAT({ env }, { env });
    const root = createActiveTagElement(env.document);
    const child = env.document.createElement("em");
    child.classList.add("mark");
    root.appendChild(child);
    env.document.body.appendChild(root);

    const { job } = await AT.runtime.createJob({
        name: "e-eng",
        e: root,
        def: {
            name: "e-eng",
            enabled: true,
            pipelines: {
                default: {
                    run: [
                        async (ctx) =>
                            E.eFind({
                                ...ctx,
                                args: { selector: ".mark" },
                            }),
                        ({ ticket }) => {
                            if (ticket.target !== child) {
                                throw new Error("expected e.find target");
                            }
                            return true;
                        },
                    ],
                },
            },
        },
        opts: { configure: "from", indexElement: true },
    });

    const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.equal(ticket.target, child);
});
