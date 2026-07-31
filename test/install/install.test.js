/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * install.js namespace/service contracts (no AT.start).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    install,
    installNamespace,
    installService,
    NAMESPACE_ID,
    SERVICE_ID,
    VERSION,
    ActiveTags,
} from "../../src/install.js";
import { createAT, ensureLib } from "../helpers/index.js";
import { createFakeEnv as fakeEnv } from "../helpers/createEnv.js";
import { installStubServices as stubs } from "../helpers/createServices.js";

test("install surface exports are stable", () => {
    assert.equal(typeof install, "function");
    assert.equal(typeof installNamespace, "function");
    assert.equal(typeof installService, "function");
    assert.equal(typeof ActiveTags, "function");
    assert.equal(NAMESPACE_ID, "app.ActiveTags");
    assert.equal(SERVICE_ID, "app.activetags");
    assert.ok(typeof VERSION === "string" && VERSION.length > 0);
});

test("installNamespace requires lib.hash.set", () => {
    assert.throws(
        () => installNamespace(null),
        /requires an m7-lib instance/
    );
    assert.throws(
        () => installNamespace({}),
        /requires lib.hash.set/
    );
});

test("installNamespace + installService register constructor and instance", () => {
    const { AT, lib } = createAT();

    const ns = installNamespace(lib);
    assert.equal(ns.installedNamespace, true);
    assert.equal(ns.namespace.ActiveTags, ActiveTags);
    assert.equal(lib.hash.get(lib, NAMESPACE_ID), ActiveTags);

    const svc = installService(lib, { instance: AT, force: true });
    assert.equal(svc.installedService, true);
    assert.equal(lib.service.get(SERVICE_ID), AT);
    assert.equal(svc.instance, AT);
});

test("installService without force reuses existing instance", () => {
    const { AT, lib } = createAT();
    installService(lib, { instance: AT, force: true });

    const again = installService(lib, { force: false });
    assert.equal(again.instance, AT);
    assert.equal(lib.service.get(SERVICE_ID), AT);
});

test("installService creates a new instance when force=true and conf provided", () => {
    const lib = ensureLib();
    stubs(lib);
    const env = fakeEnv();

    installNamespace(lib);
    // clear any prior service from other tests in this process
    if (lib.service?.set) {
        // force new
    }

    const first = installService(lib, {
        force: true,
        conf: {
            env,
            boot: { observeDom: false, events: false, intervals: false },
            log: { enabled: false },
        },
    });
    assert.ok(first.instance instanceof ActiveTags);

    const second = installService(lib, {
        force: true,
        conf: {
            env,
            boot: { observeDom: false, events: false, intervals: false },
            log: { enabled: false },
        },
    });
    assert.ok(second.instance instanceof ActiveTags);
    assert.notEqual(second.instance, first.instance);
    assert.equal(lib.service.get(SERVICE_ID), second.instance);
});

test("full install(lib, opts) wires namespace then service", () => {
    const lib = ensureLib();
    stubs(lib);
    const env = fakeEnv();

    const result = install(lib, {
        force: true,
        conf: {
            env,
            boot: { observeDom: false, events: false, intervals: false },
            log: { enabled: false },
        },
    });

    assert.equal(result.installedService, true);
    assert.ok(result.instance instanceof ActiveTags);
    assert.equal(lib.service.get(SERVICE_ID), result.instance);
    assert.equal(lib.hash.get(lib, NAMESPACE_ID), ActiveTags);
});

test("ActiveTags constructor does not start discovery/controllers", () => {
    const { AT } = createAT();
    // Inert construction: no jobs until we create them.
    assert.equal(typeof AT.start, "function");
    assert.ok(AT.engine);
    assert.ok(AT.jobs);
    assert.equal(AT.jobs.list().length, 0);
});
