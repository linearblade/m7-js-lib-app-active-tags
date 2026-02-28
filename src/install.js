/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import ActiveTags from './ActiveTags.js';
import CONSTANTS from './constants.js';
import VERSION from './version.js';

const MOD = '[app.ActiveTags]';
const NAMESPACE_ID = 'app.ActiveTags';
const SERVICE_ID = 'app.activetags';

/**
 * Canonical installer for ActiveTags namespace/service wiring.
 *
 * @see docs/contracts/INSTALL.contract.md
 */

/**
 * Install ActiveTags constructor namespace at `lib.app.ActiveTags`.
 *
 * @param {Object} lib Initialized m7 lib instance.
 * @returns {{ namespace:Object, installedNamespace:boolean }}
 * @throws {Error} When `lib` or `lib.hash.set` is missing.
 * @see docs/contracts/INSTALL.contract.md
 */
export function installNamespace(lib) {
    assertLibWithHashSet(lib, 'installNamespace(lib)');

    const namespace = { ActiveTags };
    namespace.ActiveTags = ActiveTags;
    lib.hash.set(lib, NAMESPACE_ID, ActiveTags);

    return {
        namespace,
        installedNamespace: true,
    };
}

/**
 * Install/register ActiveTags service instance at `lib.service`.
 *
 * @param {Object} lib Initialized m7 lib instance.
 * @param {Object} [opts={}]
 * @param {Object} [opts.conf]
 * @param {ActiveTags} [opts.instance]
 * @param {boolean} [opts.force=false]
 * @param {Object} [opts.namespace]
 * @returns {{ namespace:Object, instance:ActiveTags|null, installedService:boolean }}
 * @throws {Error} When required dependency/service checks fail.
 * @see docs/contracts/INSTALL.contract.md
 */
export function installService(lib, opts = {}) {
    assertLibWithHashSet(lib, 'installService(lib)');
    const hasOwn = Object.prototype.hasOwnProperty;
    const force = !!(opts && opts.force === true);
    const namespace = resolveOrInstallNamespace(lib, opts);

    let instance = null;
    const providedInstanceRaw =
        opts && hasOwn.call(opts, 'instance')
            ? opts.instance
            : null;
    const providedInstance =
        providedInstanceRaw == null
            ? null
            : assertActiveTagsInstance(providedInstanceRaw, 'opts.instance');

    ensureActiveTagsDependencies(lib);

    const hasServiceSet = !!(lib.service && typeof lib.service.set === 'function');
    const hasServiceGet = !!(lib.service && typeof lib.service.get === 'function');

    if (!hasServiceSet) {
        throw new Error(`${MOD} installService(lib) requires lib.service.set.`);
    }

    const conf =
        opts && opts.conf && typeof opts.conf === 'object'
            ? opts.conf
            : {};

    const existingInstanceRaw = hasServiceGet ? lib.service.get(SERVICE_ID) : null;
    const existingInstance = isActiveTagsLike(existingInstanceRaw)
        ? existingInstanceRaw
        : null;

    if (!force && existingInstance) {
        instance = existingInstance;
    } else if (providedInstance) {
        instance = providedInstance;
    } else {
        instance = new ActiveTags(lib, conf);
    }

    lib.service.set(SERVICE_ID, instance);
    namespace.instance = instance;

    return {
        namespace,
        instance,
        installedService: true,
    };
}

/**
 * Full install path: namespace install then service install.
 *
 * @param {Object} lib Initialized m7 lib instance.
 * @param {Object} [opts={}]
 * @param {Object} [opts.conf]
 * @param {ActiveTags} [opts.instance]
 * @param {boolean} [opts.force=false]
 * @returns {{ namespace:Object, instance:ActiveTags|null, installedService:boolean }}
 * @throws {Error} When namespace or service install preconditions fail.
 * @see docs/contracts/INSTALL.contract.md
 */
export function install(lib, opts = {}) {
    const namespaceResult = installNamespace(lib);
    return installService(lib, Object.assign({}, opts, { namespace: namespaceResult.namespace }));
}

export { ActiveTags, NAMESPACE_ID, SERVICE_ID, VERSION };
export default install;

function assertLibWithHashSet(lib, label) {
    if (!lib || typeof lib !== 'object') {
        throw new Error(`${MOD} ${label} requires an m7-lib instance object.`);
    }

    if (!lib.hash || typeof lib.hash.set !== 'function') {
        throw new Error(`${MOD} ${label} requires lib.hash.set.`);
    }
}

function resolveOrInstallNamespace(lib, opts = {}) {
    const candidate = opts && opts.namespace && typeof opts.namespace === 'object'
        ? opts.namespace
        : null;

    if (candidate && candidate.ActiveTags === ActiveTags) {
        return candidate;
    }

    return installNamespace(lib).namespace;
}

function ensureActiveTagsDependencies(lib) {
    if (!lib.require || typeof lib.require.all !== 'function' || typeof lib.require.service !== 'function') {
        throw new Error(`${MOD} installService(lib) requires lib.require.all and lib.require.service for dependency checks.`);
    }

    // Validate non-service deps first so failures are explicit and early.
    lib.require.all(CONSTANTS.CORE_DEPS, { mod: MOD });

    // Final assert: all required services must now exist.
    lib.require.service(CONSTANTS.CORE_SERVICES, { mod: MOD });
}

function isActiveTagsLike(value) {
    if (!value || typeof value !== 'object') return false;
    if (value instanceof ActiveTags) return true;

    return (
        typeof value.start === 'function' &&
        Object.prototype.hasOwnProperty.call(value, 'lib') &&
        Object.prototype.hasOwnProperty.call(value, 'engine') &&
        Object.prototype.hasOwnProperty.call(value, 'jobs')
    );
}

function assertActiveTagsInstance(candidate, label) {
    if (!isActiveTagsLike(candidate)) {
        throw new Error(`${MOD} installService(lib) ${label} must be an ActiveTags-compatible instance.`);
    }
    return candidate;
}
