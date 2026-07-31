/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Build an ActiveTags instance suitable for Node engine tests.
 *
 * Layout assumptions (sibling monorepo):
 *   m7-js-lib-app-active-tags/
 *   m7-js-lib/
 *
 * Does not call AT.start() — constructor stays inert (no scan/activation).
 */

import { lib, init as initLib } from "../../../m7-js-lib/src/index.js";
import ActiveTags from "../../src/ActiveTags.js";
import { createFakeEnv } from "./createEnv.js";
import { installStubServices } from "./createServices.js";
import { recordHooks } from "./recordHooks.js";

let libReady = false;

/**
 * Ensure the shared m7 lib is initialized once for the test process.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.force=false]
 * @returns {Object} lib
 */
export function ensureLib(opts = {}) {
    if (!libReady || opts.force === true) {
        initLib({ force: !!opts.force });
        installStubServices(lib);
        libReady = true;
    } else {
        // Re-assert services in case a prior test replaced them.
        installStubServices(lib);
    }
    return lib;
}

/**
 * Create a fresh ActiveTags instance with stub services + hook recorder.
 *
 * @param {Object} [userConf]
 * @param {Object} [opts]
 * @param {boolean} [opts.forceInit=false]
 * @param {Object} [opts.env] live env bag (takes precedence over default fake env)
 * @param {Record<string, object>} [opts.services] service id -> instance overrides
 *   (applied after stubs, before ActiveTags construction — needed for frozen controllers)
 * @returns {{ AT: ActiveTags, lib: Object, hooks: ReturnType<recordHooks>, env: Object }}
 */
export function createAT(userConf = {}, opts = {}) {
    const runtimeLib = ensureLib({ force: !!opts.forceInit });

    // Optional service overrides must win before ActiveTags freezes controller refs.
    if (opts.services && typeof opts.services === "object") {
        for (const [id, svc] of Object.entries(opts.services)) {
            runtimeLib.service.set(id, svc);
        }
    }

    // Prefer an explicit live env (DOM tests). Avoid deep-merge replacement of a
    // second env when the caller already passed conf.env.
    const env = opts.env || userConf?.env || createFakeEnv();
    const recorder = recordHooks();

    const baseConf = {
        env,
        boot: {
            observeDom: false,
            events: false,
            intervals: false,
        },
        log: {
            enabled: false,
        },
        engine: {
            hooks: recorder.hooks,
        },
    };

    // Merge user conf, but re-pin live env object so discovery keeps working even
    // if merge deep-copies nested document fields.
    const conf = runtimeLib.hash.merge(baseConf, userConf || {});
    conf.env = env;

    // Ensure hooks from userConf.engine do not wipe recorder unless explicit.
    if (!userConf?.engine?.hooks) {
        conf.engine = conf.engine || {};
        conf.engine.hooks = recorder.hooks;
    }

    const AT = new ActiveTags(runtimeLib, conf);

    return {
        AT,
        lib: runtimeLib,
        hooks: recorder,
        env,
    };
}

/**
 * Create a headless job with a simple pipeline definition.
 *
 * @param {ActiveTags} AT
 * @param {string} name
 * @param {Object} def job config fragment (pipelines, etc.)
 * @returns {Promise<{ job: Object, created: boolean }>}
 */
export async function createHeadlessJob(AT, name, def = {}) {
    const body = {
        name,
        enabled: true,
        autorun: false,
        ...def,
    };
    if (!body.pipelines && !body.pipeline) {
        throw new Error("[test] createHeadlessJob requires pipelines or pipeline");
    }

    const result = await AT.runtime.createHeadlessJob(name, body);
    if (!result?.job) {
        throw new Error(`[test] createHeadlessJob failed for "${name}"`);
    }
    if (result.job.status === "error" || result.job.config?.status === "error_schema") {
        const detail = result.job.error || result.job.config?.error || result.job.config?.schemaReport;
        throw new Error(
            `[test] headless job "${name}" config error: ${JSON.stringify(detail, null, 2)}`
        );
    }
    return result;
}

export default createAT;
