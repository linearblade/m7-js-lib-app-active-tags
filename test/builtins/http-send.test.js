/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * http.send with mocked lib.request.send.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { httpSend } from "../../src/builtins/http/index.js";
import { createAT, createHeadlessJob } from "../helpers/index.js";

function uniqueName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mockRequestSend(lib, impl) {
    const previous = lib.request;
    lib.request = Object.assign({}, previous || {}, {
        send: impl,
    });
    return () => {
        lib.request = previous;
    };
}

test("http.send loads named request, dispatches, and writes body to buffer", async () => {
    const { AT, lib } = createAT();
    const sent = [];
    const restore = mockRequestSend(lib, async (req) => {
        sent.push(req);
        return {
            ok: true,
            status: 200,
            statusText: "OK",
            url: "http://example.test/ping",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ n: 7 }),
        };
    });

    try {
        const { job } = await createHeadlessJob(AT, uniqueName("http-ok"), {
            requests: {
                ping: {
                    transport: "http",
                    endpoint: { url: "http://example.test/ping" },
                    method: "GET",
                    response: {
                        parse: "json",
                        return: "body",
                        requireOk: true,
                    },
                },
            },
            pipelines: {
                default: {
                    run: [
                        async (ctx) => httpSend({ ...ctx, args: { name: "ping" } }),
                    ],
                },
            },
        });

        const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
        await AT.engine.drain({ ticket });

        assert.equal(ticket.state, "complete");
        assert.equal(sent.length, 1);
        assert.equal(sent[0].endpoint.url, "http://example.test/ping");
        assert.deepEqual(ticket.buffer.get(), { n: 7 });
        assert.ok(ticket.buffer.meta()?.http?.response?.status === 200);
    } finally {
        restore();
    }
});

test("http.send missing named request errors the stage", async () => {
    const { AT, lib } = createAT();
    const restore = mockRequestSend(lib, async () => {
        throw new Error("should not send");
    });

    try {
        const { job } = await createHeadlessJob(AT, uniqueName("http-miss"), {
            requests: {},
            pipelines: {
                default: {
                    run: [
                        async (ctx) => httpSend({ ...ctx, args: { name: "nope" } }),
                    ],
                    error: [() => true],
                },
            },
        });

        const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
        await AT.engine.drain({ ticket });
        assert.equal(ticket.state, "complete");
        assert.match(
            String(ticket.errorInfo?.error?.message || ticket.last?.res?.error?.message || ""),
            /not found|nope|request/i
        );
    } finally {
        restore();
    }
});

test("http.send adhoc url shorthand does not require named request", async () => {
    const { AT, lib } = createAT();
    const sent = [];
    const restore = mockRequestSend(lib, async (req) => {
        sent.push(req);
        return {
            ok: true,
            status: 201,
            statusText: "Created",
            url: "http://example.test/adhoc",
            headers: {},
            body: "ok",
        };
    });

    try {
        const { job } = await createHeadlessJob(AT, uniqueName("http-adhoc"), {
            pipelines: {
                default: {
                    run: [
                        async (ctx) =>
                            httpSend({
                                ...ctx,
                                args: {
                                    adhoc: true,
                                    url: "http://example.test/adhoc",
                                    request: {
                                        method: "POST",
                                        transport: "http",
                                        response: { return: "text", parse: "text" },
                                    },
                                },
                            }),
                    ],
                },
            },
        });

        const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
        await AT.engine.drain({ ticket });
        assert.equal(ticket.state, "complete");
        assert.equal(sent.length, 1);
        assert.equal(ticket.buffer.get(), "ok");
    } finally {
        restore();
    }
});

test("http.send requireOk=false still completes when payload is not ok", async () => {
    const { AT, lib } = createAT();
    const restore = mockRequestSend(lib, async () => ({
        ok: false,
        status: 503,
        statusText: "Unavailable",
        url: "http://example.test/down",
        headers: {},
        body: "down",
    }));

    try {
        const { job } = await createHeadlessJob(AT, uniqueName("http-503"), {
            requests: {
                ping: {
                    transport: "http",
                    endpoint: { url: "http://example.test/down" },
                    method: "GET",
                    response: {
                        requireOk: false,
                        return: "text",
                        parse: "text",
                    },
                },
            },
            pipelines: {
                default: {
                    run: [
                        async (ctx) => httpSend({ ...ctx, args: { name: "ping" } }),
                    ],
                },
            },
        });

        const { ticket } = AT.engine.enqueue(job, "default", { returnMeta: true });
        await AT.engine.drain({ ticket });
        // Transport returned a real status (>0), so stage is ok even if HTTP not successful.
        assert.equal(ticket.state, "complete");
        assert.equal(ticket.buffer.get(), "down");
        assert.equal(ticket.buffer.meta()?.http?.response?.status, 503);
    } finally {
        restore();
    }
});
