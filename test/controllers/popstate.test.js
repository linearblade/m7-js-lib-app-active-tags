/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * PopStateController + @popstate.push/set builtins.
 */

import test from "node:test";
import assert from "node:assert/strict";

import CONSTANTS from "../../src/constants.js";
import popstateBuiltins from "../../src/builtins/popstate/index.js";
import {
    createAT,
    createHeadlessJob,
} from "../helpers/index.js";
import { createRecordingPopstateService } from "../helpers/createPopstate.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makePopAT() {
    const popstate = createRecordingPopstateService();
    const harness = createAT(
        {
            boot: {
                observeDom: false,
                events: false,
                intervals: false,
            },
            log: { enabled: false },
        },
        {
            services: {
                [CONSTANTS.SERVICE_POPSTATE]: popstate,
            },
        }
    );

    assert.equal(harness.AT.svc.popstate, popstate);
    assert.equal(harness.AT.popstate.popstate, popstate);
    return { ...harness, popstate };
}

test("popstate.start installs replay handler; stop uninstalls", () => {
    const { AT, popstate } = makePopAT();

    AT.popstate.start();
    assert.equal(AT.popstate.state.started, true);
    assert.ok(popstate.handlers.has("active-tags"));
    assert.ok(popstate.log.some((e) => e.op === "register"));
    assert.ok(popstate.log.some((e) => e.op === "start"));

    // idempotent
    AT.popstate.start();
    assert.equal(
        popstate.log.filter((e) => e.op === "register").length,
        1
    );

    AT.popstate.stop();
    assert.equal(AT.popstate.state.started, false);
    assert.equal(popstate.handlers.size, 0);
    assert.ok(popstate.log.some((e) => e.op === "unregister"));
});

test("seedBaseline writes baseline state once", () => {
    const { AT, popstate } = makePopAT();
    AT.popstate.start();

    const first = AT.popstate.seedBaseline();
    assert.ok(first);
    assert.equal(first.baseline, true);
    assert.equal(first.popstate, "active-tags");
    assert.equal(AT.popstate.state.baselineSeeded, true);

    const second = AT.popstate.seedBaseline();
    assert.equal(second, null, "baseline seeds only once");
    assert.equal(popstate.log.filter((e) => e.op === "set").length, 1);
});

test("popstate.push builtin writes history via controller", async () => {
    const { AT, popstate } = makePopAT();
    AT.popstate.start();

    const { job } = await createHeadlessJob(AT, uniqueName("pop-push"), {
        pipelines: {
            nav: {
                run: [
                    async (ctx) =>
                        popstateBuiltins.push({
                            ...ctx,
                            AT,
                            args: {
                                url: "http://app.test/page-2",
                                title: "Page 2",
                                state: { page: 2 },
                                inputs: { from: "test" },
                            },
                        }),
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "nav", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");

    const push = popstate.log.find((e) => e.op === "push");
    assert.ok(push, "expected push history write");
    assert.equal(push.url, "http://app.test/page-2");
    assert.ok(push.state?.replay?.jobId);
    assert.equal(push.state.replay.pipelineKey, "nav");
    assert.equal(push.state.replay.state.page, 2);
    assert.equal(popstate.history.host.location.href, "http://app.test/page-2");
});

test("popstate.set builtin rewrites current entry", async () => {
    const { AT, popstate } = makePopAT();
    AT.popstate.start();

    const { job } = await createHeadlessJob(AT, uniqueName("pop-set"), {
        pipelines: {
            mark: {
                run: [
                    async (ctx) =>
                        popstateBuiltins.set({
                            ...ctx,
                            AT,
                            args: {
                                state: { marked: true },
                                inputs: { mode: "set" },
                            },
                        }),
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "mark", { returnMeta: true });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");

    const sets = popstate.log.filter((e) => e.op === "set");
    assert.ok(sets.length >= 1);
    const last = sets[sets.length - 1];
    assert.equal(last.state?.replay?.pipelineKey, "mark");
    assert.equal(last.state?.replay?.state?.marked, true);
});

test("popstate.push skips write when ticket reason is popstate (replay)", async () => {
    const { AT, popstate } = makePopAT();
    AT.popstate.start();
    popstate.clearLog();

    const { job } = await createHeadlessJob(AT, uniqueName("pop-skip"), {
        pipelines: {
            nav: {
                run: [
                    async (ctx) =>
                        popstateBuiltins.push({
                            ...ctx,
                            AT,
                            args: {
                                url: "http://app.test/should-not-write",
                                state: { n: 1 },
                            },
                        }),
                ],
            },
        },
    });

    const { ticket } = AT.engine.enqueue(job, "nav", {
        returnMeta: true,
        inputs: { reason: "popstate" },
    });
    await AT.engine.drain({ ticket });
    assert.equal(ticket.state, "complete");
    assert.equal(
        popstate.log.filter((e) => e.op === "push").length,
        0,
        "replay path must not re-push history"
    );
});

test("writeBuiltinHistory requires job id", () => {
    const { AT } = makePopAT();
    const result = AT.popstate.writeBuiltinHistory({
        job: null,
        mode: "push",
        pipelineKey: "x",
    });
    assert.equal(result, null);
});
