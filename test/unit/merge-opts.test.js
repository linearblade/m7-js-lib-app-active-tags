/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * MERGE_OPTS_V1: arrays replace (do not concatenate).
 */

import test from "node:test";
import assert from "node:assert/strict";

import CONSTANTS from "../../src/constants.js";
import { createAT } from "../helpers/index.js";

test("MERGE_OPTS_V1 replaces arrays instead of concatenating", () => {
    const { lib } = createAT();
    const left = { tags: ["a", "b"], nested: { list: [1, 2] }, n: 1 };
    const right = { tags: ["c"], nested: { list: [9] }, n: 2 };

    const merged = lib.hash.merge(left, right, CONSTANTS.MERGE_OPTS_V1);
    assert.deepEqual(merged.tags, ["c"]);
    assert.deepEqual(merged.nested.list, [9]);
    assert.equal(merged.n, 2);
});

test("MERGE_OPTS_V1 array+scalar overwrites array", () => {
    const { lib } = createAT();
    const merged = lib.hash.merge(
        { v: [1, 2, 3] },
        { v: "x" },
        CONSTANTS.MERGE_OPTS_V1
    );
    assert.equal(merged.v, "x");
});
