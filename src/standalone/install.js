/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import { lib as sharedLib, init as initLib } from "../../../m7-js-lib/src/index.js";
import CONSTANTS from "../constants.js";
import installActiveTags from "../install.js";

import installDomChangeObserver from "../../../m7-js-lib-primitive-dom-changeobserver/src/install.js";
import installEventDelegator from "../../../m7-js-lib-primitive-dom-eventdelegator/src/install.js";
import installInterval from "../../../m7-js-lib-primitive-interval/src/install.js";
import installPopStateManager from "../../../m7-js-lib-app-popstatemanager/src/install.js";
import { basic as installSinglePageAppBasic } from "../../../m7-js-lib-app-single-page/src/install/index.js";
import LogManager from "../../../m7-js-lib-primitive-log/src/Manager.js";
import LogWorker from "../../../m7-js-lib-primitive-log/src/Worker.js";
import logUtils from "../../../m7-js-lib-primitive-log/src/utils.js";
import * as logConstants from "../../../m7-js-lib-primitive-log/src/constants.js";

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

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function asObject(value) {
    return isObject(value) ? value : {};
}

function isRootSpec(value) {
    return !!(
        isPlainObject(value)
        && value.root
        && value.host
    );
}

function readFeatureToggle(value) {
    if (value === true) {
        return {
            enabled: true,
            options: {},
        };
    }

    if (isPlainObject(value)) {
        const enabled = Object.prototype.hasOwnProperty.call(value, "enabled")
            ? value.enabled === true
            : true;
        const options = Object.assign({}, value);
        delete options.enabled;
        return {
            enabled,
            options,
        };
    }

    return {
        enabled: false,
        options: {},
    };
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
 * @param {boolean|Object} [opts.popstate=false]
 * @param {boolean|Object} [opts.spa=false]
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

    installSpaFeature(runtimeLib, opts);
    if (!readFeatureToggle(opts.spa).enabled) {
        installPopstateFeature(runtimeLib, opts);
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
 * @param {boolean|Object} [opts.popstate=false]
 * @param {boolean|Object} [opts.spa=false]
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

function installLog(lib, opts = {}) {
    if (!lib || typeof lib !== "object") {
        throw new Error(`${MOD} installLog(lib) requires an m7-lib instance object.`);
    }

    if (!lib.hash || typeof lib.hash.set !== "function") {
        throw new Error(`${MOD} installLog(lib) requires lib.hash.set.`);
    }

    const hasHashGet = !!(lib.hash && typeof lib.hash.get === "function");
    const hasServiceSet = !!(lib.service && typeof lib.service.set === "function");
    const hasServiceGet = !!(lib.service && typeof lib.service.get === "function");
    const hasOwn = Object.prototype.hasOwnProperty;
    const serviceId = CONSTANTS.SERVICE_LOG;

    const hasHost = hasOwn.call(opts, "host");
    const hasRoot = hasOwn.call(opts, "root");
    const envRoot = resolveEnvRoot(lib);

    const resolvedRoot =
        hasRoot
            ? opts.root
            : (envRoot !== undefined ? envRoot : undefined);

    const resolvedHost =
        hasHost
            ? opts.host
            : (resolvedRoot !== undefined ? resolvedRoot : resolveGlobalHost());

    let namespace = null;
    if (hasHashGet) {
        try {
            namespace = lib.hash.get(lib, serviceId);
        } catch (err) {
            namespace = null;
        }
    }

    if (!namespace || typeof namespace !== "object") {
        namespace = {};
    }

    namespace.Manager = LogManager;
    namespace.Worker = LogWorker;
    namespace.utils = logUtils;
    namespace.constants = logConstants;
    lib.hash.set(lib, serviceId, namespace);

    let instance = null;
    let installedService = false;

    if (hasServiceSet) {
        const force = opts.force === true;
        const providedInstance = opts.instance || null;
        const existingInstance = hasServiceGet ? lib.service.get(serviceId) : null;

        if (!force && existingInstance) {
            instance = existingInstance;
        } else if (providedInstance) {
            instance = providedInstance;
        } else {
            const managerOptions =
                opts.managerOptions && typeof opts.managerOptions === "object"
                    ? opts.managerOptions
                    : {};

            const finalManagerOptions = Object.assign({}, managerOptions);

            if (!hasOwn.call(finalManagerOptions, "lib")) {
                finalManagerOptions.lib = lib;
            }

            if (!hasOwn.call(finalManagerOptions, "root") && resolvedRoot !== undefined) {
                finalManagerOptions.root = resolvedRoot;
            }

            if (!hasOwn.call(finalManagerOptions, "host") && resolvedHost !== undefined) {
                finalManagerOptions.host = resolvedHost;
            }

            instance = new LogManager(finalManagerOptions);
        }

        lib.service.set(serviceId, instance);
        namespace.instance = instance;
        installedService = true;
        lib.hash.set(lib, serviceId, namespace);
    } else if (opts.instance) {
        namespace.instance = opts.instance;
        lib.hash.set(lib, serviceId, namespace);
        instance = opts.instance;
    }

    return {
        namespace,
        instance,
        installedService,
    };
}

function installPopstateFeature(lib, opts = {}, extra = {}) {
    const feature = readFeatureToggle(opts.popstate);
    const required = extra.required === true;
    if (!feature.enabled && !required) {
        return null;
    }

    const installOpts = buildPopstateOptions(lib, opts, feature.options, extra.overrideOptions);
    return installPopStateManager(lib, installOpts);
}

function installSpaFeature(lib, opts = {}) {
    const feature = readFeatureToggle(opts.spa);
    if (!feature.enabled) {
        return null;
    }

    // SPA always depends on popstate, even when popstate itself is not
    // explicitly enabled at the top level.
    installPopstateFeature(lib, opts, {
        required: true,
        overrideOptions: {
            start: false,
        },
    });

    const installOpts = buildSpaOptions(lib, opts, feature.options);
    return installSinglePageAppBasic(lib, installOpts);
}

function buildPopstateOptions(lib, globalOpts = {}, featureOpts = {}, overrideOpts = {}) {
    const source = Object.assign({}, asObject(globalOpts), asObject(featureOpts));
    const host = resolveHost(lib, source);
    const out = Object.assign(
        {
            host,
            start: false,
        },
        asObject(featureOpts),
        asObject(overrideOpts)
    );

    out.conf = isPlainObject(out.conf) ? out.conf : {};
    return out;
}

function buildSpaOptions(lib, globalOpts = {}, featureOpts = {}) {
    const source = Object.assign({}, asObject(globalOpts), asObject(featureOpts));
    const host = resolveHost(lib, source);
    const root = resolveRoot(lib, host, source);
    const out = Object.assign({}, asObject(featureOpts));

    if (out.root && !isRootSpec(out.root) && host) {
        out.root = {
            root: out.root,
            host,
        };
    } else if (!out.root && root && host) {
        out.root = {
            root,
            host,
        };
    }

    return out;
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

function resolveHost(lib, opts = {}) {
    if (isPlainObject(opts.host) && opts.host.location && opts.host.history) {
        return opts.host;
    }

    const bootRoot = lib && lib._env ? lib._env.root : null;
    if (bootRoot && bootRoot.location && bootRoot.history) {
        return bootRoot;
    }

    if (typeof window !== "undefined" && window && window.location && window.history) {
        return window;
    }

    return null;
}

function resolveEnvRoot(lib) {
    if (!lib || typeof lib !== "object") return undefined;

    if (lib._env && Object.prototype.hasOwnProperty.call(lib._env, "root")) {
        return lib._env.root;
    }

    if (lib.hash && typeof lib.hash.get === "function") {
        try {
            return lib.hash.get(lib, "_env.root");
        } catch (err) {
            return undefined;
        }
    }

    return undefined;
}

function resolveGlobalHost() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return undefined;
}

function resolveRoot(lib, host = null, opts = {}) {
    if (opts.root && typeof opts.root.addEventListener === "function") {
        return opts.root;
    }

    const docFromEnv = lib && lib._env && lib._env.root && lib._env.root.document
        ? lib._env.root.document
        : null;
    if (docFromEnv && typeof docFromEnv.addEventListener === "function") {
        return docFromEnv;
    }

    if (host && host.document && typeof host.document.addEventListener === "function") {
        return host.document;
    }

    if (typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
        return document;
    }

    return null;
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
