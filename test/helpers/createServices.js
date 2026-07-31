/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Minimal CORE_SERVICES stubs for ActiveTags construction in Node.
 *
 * Engine/ticket tests do not exercise real event/interval/observer/popstate
 * implementations. Controllers only require the service reference to exist
 * at construction time.
 */

import CONSTANTS from "../../src/constants.js";

function makeStub(id) {
    return {
        id,
        start() {},
        stop() {},
        on() {},
        off() {},
        register() {},
        registerAll() {},
        createBucket() {},
        setSelectors() {},
        // popstate-ish no-ops
        push() {},
        replace() {},
        seed() {},
    };
}

/**
 * Install stub services required by ActiveTags onto an m7 lib instance.
 *
 * @param {Object} lib
 * @returns {Record<string, object>} map of service id -> stub
 */
export function installStubServices(lib) {
    if (!lib?.service || typeof lib.service.set !== "function") {
        throw new Error("[test] installStubServices requires lib.service.set");
    }

    const map = {};
    for (const id of CONSTANTS.CORE_SERVICES) {
        const stub = makeStub(id);
        lib.service.set(id, stub);
        map[id] = stub;
    }

    // Log is in CORE_SERVICES; ensure createBucket is present for AT constructor.
    const log = map[CONSTANTS.SERVICE_LOG] || makeStub(CONSTANTS.SERVICE_LOG);
    log.createBucket = function createBucket() {};
    lib.service.set(CONSTANTS.SERVICE_LOG, log);
    map[CONSTANTS.SERVICE_LOG] = log;

    return map;
}

export default installStubServices;
