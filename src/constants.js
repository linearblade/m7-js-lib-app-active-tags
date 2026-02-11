/**
 * ActiveTags CONSTANTS
 * -------------------
 *
 * This module defines the **stable vocabulary** and **structural expectations**
 * of the ActiveTags runtime (names, keys, enums, dependency identifiers, and
 * merge semantics).
 *
 * PURPOSE:
 * - Centralize “static” identifiers used across the system:
 *     - service keys
 *     - status enums
 *     - job types
 *     - merge / normalization policy objects
 * - Provide version-stable constants that are safe to reference at runtime.
 *
 * NON-GOALS:
 * - This module is NOT a source of "last line" fallback values.
 *   If a value is a runtime fallback (selector defaults, log policy defaults, etc.),
 *   it belongs in `LAST_LINE_DEFAULTS.js` and should be consumed only by Schema.
 *
 * POLICY:
 * - No imports
 * - No runtime logic
 * - No side effects
 * - Pure data only
 *
 * This separation prevents config-mismatch bugs and ensures the compiled config
 * (`AT.conf`) remains the single source of truth for runtime behavior.
 */


// ─────────────────────────────────────────
// Core library dependencies
// ─────────────────────────────────────────

export const LIB_HASH = "hash";

export const CORE_DEPS = [
    "primitive.workspace",
    "dom",
    "str.interp",
];


// ─────────────────────────────────────────
// Core services
// ─────────────────────────────────────────

export const SERVICE_DELEGATOR = "primitive.dom.eventdelegator";
export const SERVICE_LOG       = "primitive.log";
export const SERVICE_INTERVAL  = "primitive.interval";
export const SERVICE_OBSERVER  = "primitive.dom.changeobserver";

export const CORE_SERVICES = [
    SERVICE_DELEGATOR,
    SERVICE_LOG,
    SERVICE_INTERVAL,
    SERVICE_OBSERVER,
];


// ─────────────────────────────────────────
// Job related
// ─────────────────────────────────────────

export const JOB_CONFIG_STATUS = {
    INIT:         "init",
    ERROR_DOM:    "error_dom",
    ERROR_SCHEMA: "error_schema",
    READY:        "ready",
};

export const JOB_STATUS = Object.freeze({
    READY:        "ready",
    RUNNING:      "running",
    WAIT:         "wait",
    ERROR:        "error",
    CONFIG_ERROR: "config_error",
    COMPLETE:     "complete",
    DETACHED:     "detached",
});

export const JOB_TYPE = Object.freeze({
    LOAD:   "load",
    SUBMIT: "submit",
    MANUAL: "manual",
});


// ─────────────────────────────────────────
// Helpers / merge semantics
// ─────────────────────────────────────────

export const ARR_TO_OPTS = { split: /\s+/, trim: true };

// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
        aa: function (l, r) { return r; }, // array + array  => replace
        as: function (l, r) { return r; }, // array + scalar => overwrite
        // hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};


// ─────────────────────────────────────────
// Runtime (scheduler state model)
// ─────────────────────────────────────────

export const SCHED_STATUS = Object.freeze({
    READY:    "ready",
    RUNNING:  "running",
    WAIT:     "wait",
    ERROR:    "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});


// ─────────────────────────────────────────
// Logging (bucket identifiers only; not bucket values/policy defaults)
// ─────────────────────────────────────────

export const LOG_BUCKETS = {
    ROOT:     "ROOT",
    CONFIG:   "CONFIG",
    RUNTIME:  "RUNTIME",
    PIPELINE: "PIPELINE",
};


// ─────────────────────────────────────────
// Default export (convenience / introspection)
// NOTE: intentionally excludes LAST_LINE_DEFAULTS.
// ─────────────────────────────────────────

export default {
    LIB_HASH,
    CORE_DEPS,

    SERVICE_DELEGATOR,
    SERVICE_INTERVAL,
    SERVICE_OBSERVER,
    SERVICE_LOG,
    CORE_SERVICES,

    JOB_CONFIG_STATUS,
    JOB_STATUS,
    JOB_TYPE,

    ARR_TO_OPTS,
    MERGE_OPTS_V1,

    SCHED_STATUS,

    LOG_BUCKETS,
};
