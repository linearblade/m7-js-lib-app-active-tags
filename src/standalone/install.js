/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import { lib as sharedLib, init as initLib } from "../../../m7-js-lib/src/index.js";
import CONSTANTS from "../constants.js";
import installActiveTags from "../install.js";

import installDomChangeObserver from "../../../m7-js-lib-primitive-dom-changeobserver/src/install.js";
import installEventDelegator from "../../../m7-js-lib-primitive-dom-eventdelegator/src/install.js";
import installLog from "../../../m7-js-lib-primitive-log/src/install.js";
import installInterval from "../../../m7-js-lib-primitive-interval/src/install.js";

const MOD = "[activeTags.standalone.install]";
const PRIMITIVE_INSTALLERS = Object.freeze([
    {
        id: CONSTANTS.SERVICE_DELEGATOR,
        optKey: "eventDelegator",
        install: installEventDelegator,
    },
    {
        id: CONSTANTS.SERVICE_INTERVAL,
        optKey: "interval",
        install: installInterval,
    },
    {
        id: CONSTANTS.SERVICE_LOG,
        optKey: "log",
        install: installLog,
    },
    {
        id: CONSTANTS.SERVICE_OBSERVER,
        optKey: "domChangeObserver",
        install: installDomChangeObserver,
    },
]);

function isObject(value) {
    return !!value && typeof value === "object";
}

function asObject(value) {
    return isObject(value) ? value : {};
}

function ensureLibReady(opts = {}) {
    opts = asObject(opts);
    const hasLibOverride = Object.prototype.hasOwnProperty.call(opts, "lib");
    const runtimeLib = hasLibOverride ? opts.lib : sharedLib;

    if (!isObject(runtimeLib)) {
        throw new Error(`${MOD} missing lib instance.`);
    }

    const needsInit = !runtimeLib._initialized || opts.forceInit === true;
    if (needsInit && runtimeLib !== sharedLib) {
        throw new Error(`${MOD} opts.lib must be pre-initialized (cannot auto-init external lib instance).`);
    }

    if (needsInit) {
        initLib({ force: !!opts.forceInit });
    }

    return runtimeLib;
}

/**
 * Install ActiveTags-required primitive services against bundled lib.
 *
 * @param {Object} [opts={}]
 * @param {Object} [opts.lib]
 * @param {boolean} [opts.forceInit=false]
 * @param {boolean} [opts.installMissingServices=true]
 * @param {Object} [opts.eventDelegator]
 * @param {Object} [opts.interval]
 * @param {Object} [opts.log]
 * @param {Object} [opts.domChangeObserver]
 * @returns {Object} lib instance
 */
function installServices(opts = {}) {
    opts = asObject(opts);
    const runtimeLib = ensureLibReady(opts);
    if (opts.installMissingServices === false) {
        return runtimeLib;
    }

    for (const item of PRIMITIVE_INSTALLERS) {
        const primitiveOpts = resolvePrimitiveOpts(runtimeLib, item, opts);
        if (hasService(runtimeLib, item.id)) {
            maybeStartService(runtimeLib, item.id, primitiveOpts);
            continue;
        }
        item.install(runtimeLib, primitiveOpts);
    }

    return runtimeLib;
}

/**
 * Install ActiveTags against bundled lib.
 *
 * This wrapper:
 * - ensures bundled lib is initialized
 * - installs missing primitive services in standalone mode
 * - delegates final ActiveTags wiring to canonical `src/install.js`
 *   (namespace + service instance registration)
 * - returns installer result and resolved lib
 *
 * @param {Object} [opts={}]
 * @param {Object} [opts.lib]
 * @param {boolean} [opts.forceInit=false]
 * @param {boolean} [opts.installMissingServices=true]
 * @param {Object} [opts.eventDelegator]
 * @param {Object} [opts.interval]
 * @param {Object} [opts.log]
 * @param {Object} [opts.domChangeObserver]
 * @returns {Object} lib instance
 */
export function install(opts = {}) {

    opts = asObject(opts);
    const runtimeLib = installServices(opts);
    const installOpts = {
        conf: asObject(opts.conf),
        force: opts.force === true,
    };

    if (Object.prototype.hasOwnProperty.call(opts, "instance")) {
        installOpts.instance = opts.instance;
    }
    installActiveTags(runtimeLib, installOpts);
    return runtimeLib;
}

export { sharedLib as lib, initLib };
export default install;

function hasService(lib, serviceId) {
    if (!serviceId) return false;

    if (lib.service && typeof lib.service.get === "function") {
        const candidate = lib.service.get(serviceId);
        return candidate !== undefined && candidate !== null;
    }

    try {
        const list = lib.require && typeof lib.require.service === "function"
            ? lib.require.service(serviceId, { mod: MOD, die: false })
            : [];
        return Array.isArray(list) && list.length > 0;
    } catch (err) {
        return false;
    }
}

function resolvePrimitiveOpts(lib, item, opts) {
    const defaults = getPrimitiveDefaultOpts(lib, item);
    const explicit = asObject(opts[item.optKey]);
    return Object.assign({}, defaults, explicit);
}

function maybeStartService(lib, serviceId, opts = {}) {
    if (opts.start !== true) return;
    if (!lib.service || typeof lib.service.get !== "function") return;

    const service = lib.service.get(serviceId);
    if (!service || typeof service.start !== "function") return;
    service.start();
}

function getPrimitiveDefaultOpts(lib, item) {
    if (!item || !item.optKey) return {};

    if (item.optKey === "eventDelegator") {
        return canAutoStartDelegator(lib) ? { start: true } : {};
    }
    if (item.optKey === "domChangeObserver") {
        return canAutoStartDomChangeObserver(lib) ? { start: true } : {};
    }

    return {};
}

function canAutoStartDelegator(lib) {
    const doc = resolveDocument(lib);

    return !!(
        doc &&
        typeof doc.addEventListener === "function" &&
        typeof doc.removeEventListener === "function"
    );
}

function canAutoStartDomChangeObserver(lib) {
    const doc = resolveDocument(lib);
    if (!doc) return false;

    const rootCandidate = doc.body || doc.documentElement || doc;
    if (!rootCandidate || typeof rootCandidate !== "object") return false;

    return hasMutationObserver(lib);
}

function resolveDocument(lib) {
    const docFromEnv =
        lib &&
        lib._env &&
        lib._env.root &&
        lib._env.root.document
            ? lib._env.root.document
            : null;

    if (docFromEnv) return docFromEnv;
    if (typeof document !== "undefined") return document;
    return null;
}

function hasMutationObserver(lib) {
    const hostFromEnv =
        lib &&
        lib._env &&
        lib._env.root
            ? lib._env.root
            : null;

    if (hostFromEnv && typeof hostFromEnv.MutationObserver === "function") {
        return true;
    }

    if (typeof MutationObserver === "function") {
        return true;
    }

    return false;
}
