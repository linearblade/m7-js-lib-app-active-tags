// src/constants.js

/**
 * ActiveTags constants.
 *
 * POLICY:
 * - No imports
 * - No runtime logic
 * - No side effects
 * - Pure data only
 *
 * These values are version-stable and define
 * structural and dependency expectations.
 */

// ─────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────

export const DEFAULT_SELECTOR = '[data-activetag]';
export const DEFAULT_ATTRIBUTE_SELECTOR = 'data-activetag';

// ─────────────────────────────────────────
// Core library dependencies
// ─────────────────────────────────────────

export const LIB_HASH = 'hash';

export const CORE_DEPS = [
    'primitive.workspace',
    'dom',
    'str.interp'
];

// ─────────────────────────────────────────
// Core services
// ─────────────────────────────────────────

export const SERVICE_DELEGATOR = 'primitive.dom.eventdelegator';
export const SERVICE_LOG       = "primitive.log";
export const SERVICE_INTERVAL  = "primitive.interval";
export const SERVICE_OBSERVER  = "primitive.dom.changeobserver";
export const CORE_SERVICES = [    SERVICE_DELEGATOR, SERVICE_LOG, SERVICE_INTERVAL, SERVICE_OBSERVER ];


// ------------------------------------------
// Job related
// ------------------------------------------
export const JOB_CONFIG_STATUS = {
    INIT         : "init",
    ERROR_DOM    : "error_dom",
    ERROR_SCHEMA : "error_schema",
    READY        : "ready"
    
};
export const JOB_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});

export const JOB_TYPE = Object.freeze({
    LOAD: "load",
    SUBMIT: "submit",
    MANUAL: "manual",
});

// ─────────────────────────────────────────
// helpers
// ─────────────────────────────────────────

export const ARR_TO_OPTS = {split:/\s+/,trim:true};

export const DOM_ATTRS_RUNTIME_INPUTS = [
    "id",
    "name",
    "action",
    "method",
    "enctype",
    "tagName"
];
export const DOM_CONFIG_AT = "config-at at";
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
        aa: function (l, r) { return r; }, // array + array  => replace
        as: function (l, r) { return r; }  // array + scalar => overwrite
        // hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};


// ─────────────────────────────────────────
// runtime
// ─────────────────────────────────────────

export const SCHED_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});


// ─────────────────────────────────────────
// Default export (convenience / introspection)
// ─────────────────────────────────────────




export default {
    DEFAULT_SELECTOR,
    DEFAULT_ATTRIBUTE_SELECTOR,
    LIB_HASH,
    CORE_DEPS,
    SERVICE_DELEGATOR,
    SERVICE_INTERVAL,
    SERVICE_OBSERVER,
    SERVICE_LOG,
    CORE_SERVICES,
    JOB_CONFIG_STATUS,JOB_STATUS, JOB_TYPE,
    ARR_TO_OPTS, DOM_ATTRS_RUNTIME_INPUTS, DOM_CONFIG_AT, MERGE_OPTS_V1,
    SCHED_STATUS
};
