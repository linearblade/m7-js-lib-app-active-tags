/**
 * LAST_LINE_DEFAULTS
 * ------------------
 *
 * This module contains **hard fallback defaults** (the “last line of defense”)
 * for ActiveTags configuration compilation.
 *
 * PURPOSE:
 * - Prevent runtime breakage when configuration is missing, malformed, or incomplete.
 * - Protect against:
 *     - user misconfiguration
 *     - engineer mistakes in DEFAULT_CONFIG (yes, us)
 *     - partial merges / legacy configs during migration
 *
 * CRITICAL POLICY:
 * - These values should be referenced **only** by the configuration compiler/schema
 *   (e.g. `at_config/Schema.js`) as a final safety net.
 * - Runtime subsystems (controllers, engine, jobs, etc.) should rely only on the
 *   compiled config (`AT.conf`) and should NOT import this module directly.
 *
 * This keeps configuration behavior deterministic and prevents “config mismatch”
 * bugs caused by scattered fallbacks.
 */

// ─────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────

// Used by DOM discovery (sweep) and as a fallback selector for observation.
export const DEFAULT_SELECTOR = "[data-activetag]";

// Used by the DOM observer as the attributeFilter fallback.
// NOTE: keep this aligned with DEFAULT_SELECTOR semantics.
export const DEFAULT_ATTRIBUTE_SELECTOR = "data-activetag";

export const DEFAULT_EVAL_TYPE = ["text/at-eval", "text/at-config"];
// ─────────────────────────────────────────
// DOM config pointers / inputs
// ─────────────────────────────────────────

export const DOM_ATTRS_RUNTIME_INPUTS = [
    "id",
    "name",
    "action",
    "method",
    "enctype",
    "tagName",
];

// pulls from dataset, not from attributes directly (ie data-xyz). use dot notation.
export const DOM_CONFIG_AT = "config.at at";


// ─────────────────────────────────────────
// Logging fallbacks
// ─────────────────────────────────────────

export const LOG_BUCKETS_DEFAULT_VALUES = {
    ROOT:    "activetags",
    CONFIG:  "activetags.config",
    RUNTIME: "activetags.runtime",
    PIPELINE:"activetags.pipeline",
};

export const LOG_POLICY = {
    console: "warn", // print warn+error, suppress log/info
};


// ─────────────────────────────────────────
// Default export (convenience)
// ─────────────────────────────────────────

export default {
    DEFAULT_SELECTOR,
    DEFAULT_ATTRIBUTE_SELECTOR,
    DOM_ATTRS_RUNTIME_INPUTS,
    DOM_CONFIG_AT,
    LOG_BUCKETS_DEFAULT_VALUES,
    LOG_POLICY,
    DEFAULT_EVAL_TYPE
};
