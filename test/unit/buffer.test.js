/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Pure unit tests for engine Buffer (no ActiveTags runtime required).
 */

import test from "node:test";
import assert from "node:assert/strict";

import Buffer from "../../src/class/engine/Buffer.js";

test("Buffer set/get/meta/clear basics", () => {
    const buf = new Buffer();
    assert.equal(buf.get(), null);

    buf.set({ a: 1 }, { source: "t1" });
    assert.deepEqual(buf.get(), { a: 1 });
    assert.deepEqual(buf.meta(), { source: "t1" });

    buf.set({ a: 2, b: 3 }, { source: "t2", extra: true });
    assert.deepEqual(buf.get(), { a: 2, b: 3 });
    // meta is shallow-merged, value is replaced
    assert.deepEqual(buf.meta(), { source: "t2", extra: true });

    buf.clear();
    assert.equal(buf.get(), null);
    assert.deepEqual(buf.meta(), {});
});

test("Buffer constructor initial value", () => {
    const buf = new Buffer({ seed: true });
    assert.deepEqual(buf.get(), { seed: true });
});

test("Buffer toJSON returns value only", () => {
    const buf = new Buffer();
    buf.set({ x: 1 }, { source: "hidden" });
    assert.deepEqual(buf.toJSON(), { x: 1 });
    assert.equal(JSON.stringify(buf), JSON.stringify({ x: 1 }));
});

test("Buffer set without meta leaves prior meta intact when omitted", () => {
    const buf = new Buffer();
    buf.set("a", { source: "s" });
    buf.set("b");
    assert.equal(buf.get(), "b");
    assert.deepEqual(buf.meta(), { source: "s" });
});
