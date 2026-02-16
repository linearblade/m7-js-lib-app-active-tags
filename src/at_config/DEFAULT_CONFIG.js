import freezeDeep from '../helpers/freezeDeep.js';
/**
 * ActiveTags default configuration baseline.
 *
 * This module exports a deep-frozen runtime default config used as the schema
 * compiler baseline (`def_conf`).
 *
 * Contract:
 * - Values here are defaults, not runtime state.
 * - Runtime behavior is activated by the compiled snapshot (`AT.conf`), not by
 *   mutating this object directly.
 * - Consumers should override via constructor config, not by editing frozen
 *   references at runtime.
 */
export const DEFAULT_CONFIG = freezeDeep(
    {
	// ---------------------------------------------------------------------------
	// Default job configuration.
	// This block defines the baseline configuration schema for runtime job configs.
	//
	// Notes:
	// - `job.config.base` is runtime data only; it is not a schema override.
	// - This schema does NOT inject or alias any top-level base config.
	// - Users who wish to modify the runtime job base must do so explicitly via:
	//     lib.hash.set(config, "job.config.base", {...})
	//
	// Precedence (low → high):
	//   1) default job.config (this file)
	//   2) user job.config overrides
	//   3) external / inline job config (if allowed)
	//
	// In most cases, defaults here are sufficient.

	// ---------------------------------------------------------------------------
	// Environment (optional; inferred if omitted)
	// m7-lib usually infers this automatically.
	// In normal browser environments this can typically be left empty.
	// ---------------------------------------------------------------------------
	//example:
	//env: { window, document, root: window },
	env: {},

	// ---------------------------------------------------------------------------
	// Job configuration policy
	// (how job config is discovered, parsed, merged, and interpreted)
	// ---------------------------------------------------------------------------
	job: {
	    // registry wiring / behavior (JobRegistry service config)
	    registry: {
		//registry ids are prefixed with this. it is not a selector!
		prefix: "at"
	    },
	    config: {
		// --- where job config is allowed to come from ---
		allowExternal: true,                 // false => base-only mode (no DOM / script config)

		// DSL pointer(s) to job config sources (used only if allowExternal === true)
		at: ["config.at", "at"],

		// Base job configuration.
		// This is the lowest-precedence config object used when compiling job config.
		// Non-object values will be coerced to an object.
		//
		// Merge precedence (low → high):
		//   1) job.config.base               (this block)
		//   2) job_config_base               (top-level convenience override, if present)
		//   3) job.config (explicit user config)
		//   4) external / inline job config  (if allowExternal === true)
		//
		base: {},
		// --- how job-related DOM attributes / config keys are read ---
		attrPrefixes: ["data-", "at-"],

		// --- evaluation / import policy for job config ---
		evalEnabled: true,
		evalType: ["text/at-eval", "text/at-config"],
		importEnabled: true,
		importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
		// --- capture attrs on configuration ---
		// Presently retained as a compatibility/convenience capture list.
		// May later support fallback naming or reset workflows.
		capture_attrs : [ "id",
				  "name",
				  "action",
				  "method",
				  "enctype",
				  "tagName"
				],
		// --- merge semantics for layered job config ---
		// base    : constructor-provided config
		// external: DOM / script-derived config
		// inline  : inline or per-element overrides
		merge: {
		    order: ["base", "external", "inline"],
		    objects: "deep",
		    arrays: "concatUnique"
		}
	    }
	},

	// ---------------------------------------------------------------------------
	// Boot policy
	// (one-time initialization behavior + initial runtime enablement)
	// ---------------------------------------------------------------------------
	boot: {
	    // DOM discovery selector used during boot sweep
	    selector: "[data-activetag]",

	    // perform initial DOM sweep immediately on construction
	    bootSweep: true,

	    // start DOM observer for dynamically-added elements
	    observeDom: true,

	    // initial runtime state only (can be changed later via runtime API)
	    intervals: true,
	    events: true
	},

	// ---------------------------------------------------------------------------
	// Logging / Diagnostics Policy
	// ---------------------------------------------------------------------------
	//
	// This block controls integration with `lib.primitive.log`
	// (resolved via `lib.service`, typically `lib.svc.log`).
	//
	// ActiveTags does NOT implement its own logger.
	// It delegates all structured logging, bucket management,
	// and console policy enforcement to m7-js-lib-primitive-log.
	//
	// See: m7-js-lib-primitive-log documentation for full behavior.
	//
	// ---------------------------------------------------------------------------
	// Behavior
	// ---------------------------------------------------------------------------
	//
	// - Buckets defined here are created automatically if they do not exist.
	// - Logging output level is governed by `policy.console`.
	// - Pipeline/VM tracing is controlled by `policy.trace`.
	// - Disabling `enabled` suppresses ActiveTags log emission,
	//   but does not disable the underlying log service.
	//
	// In most projects, there is no need to modify bucket names.
	//
	// ---------------------------------------------------------------------------

	log: {
	    enabled: true,

	    policy: {
		console: "warn",   // warn | error | info | log (as supported by lib logger)
		trace: false       // pipeline / VM trace output
	    },

	    // Logging buckets are created if not already present.
	    // Advanced projects may customize these.
	    buckets: {
		ROOT:     "activetags",
		CONFIG:   "activetags.config",
		RUNTIME:  "activetags.runtime",
		PIPELINE: "activetags.pipeline",
	    }
	},

	// ---------------------------------------------------------------------------
	// Error handling posture
	// ---------------------------------------------------------------------------
	errors: {
	    // behavior when a pipeline op throws
	    onOpError: "error"   // "error" | "complete" | "continue" (if supported)
	},
	
	// ---------------------------------------------------------------------------
	// Mutation Observer Policy
	// ---------------------------------------------------------------------------
	//
	// Controls how ActiveTags reacts to DOM mutations.
	//
	// This subsystem is responsible for reacting to:
	// - element insertion/removal
	// - selector membership transitions
	// - attribute changes that affect selector matching
	//
	// IMPORTANT:
	// - Runtime enablement is controlled by `boot.observeDom`.
	// - This block configures observation behavior only.
	// - Observation does NOT reconcile prior DOM state.
	//   Call `discover()` for full reconciliation at startup.
	//
	// SELECTOR RESOLUTION:
	// - `observe.selector` is the CSS selector used by the observer.
	// - If omitted or empty, it falls back to `boot.selector`.
	// - This selector determines which elements are considered relevant.
	//
	// ATTRIBUTE FILTER SEMANTICS:
	// - `attribute_filter` defines which attribute changes trigger
	//   re-evaluation of selector membership.
	// - May be a string or array of strings.
	// - Only attribute names listed here will trigger observer checks.
	// - The filter is OR-based (any listed attribute change will trigger).
	//
	// DESIGN NOTE:
	// - `attribute_filter` should generally include the attribute(s)
	//   referenced by `selector`.
	// - If they do not align, selector transitions may not be detected.
	// - See DomChangeObserver documentation for deeper behavior details.
	//
	// ---------------------------------------------------------------------------

	observe: {
	    // CSS selector for observer matching.
	    // Falls back to `boot.selector` if omitted.
	    selector: "[data-activetag]",

	    // Attribute(s) that trigger selector re-evaluation.
	    // String or array accepted.
	    attribute_filter: ["data-activetag", "data-foo"],

	    // Debounce window (ms) for batching mutation events.
	    debounceMs: 25,

	    // If true, attribute mutations are observed.
	    // If false, only childList/subtree mutations are processed.
	    observeAttributes: true,
	},

	// ---------------------------------------------------------------------------
	// Engine configuration
	// ---------------------------------------------------------------------------
	//
	// The `engine` block defines the functional surface and lookup policy
	// exposed to the runtime execution engine (builtins + hooks + opResolution).
	//
	// This block is compiled at configuration time into a normalized,
	// functions-only map. Non-function values are discarded.
	//
	// ---------------------------------------------------------------------------
	// builtins
	// ---------------------------------------------------------------------------
	//
	// Controls the builtin operation library available to pipelines.
	//
	// Semantics:
	//   builtins === true
	//     → Use the standard ActiveTags builtins bundle.
	//
	//   builtins === null / false / explicit opt-out
	//     → Disable all builtins (empty object).
	//
	//   builtins === { ... }
	//     → Treated as a hash (may be nested).
	//       Merged over the default builtins using MERGE_OPTS_V1.
	//       Result is filtered deeply to function values only.
	//
	// Notes:
	//   - Deep structures are allowed.
	//   - Empty containers are compacted during compilation.
	//   - Final surface is always a clean hash of functions.
	//
	// ---------------------------------------------------------------------------
	// hooks
	// ---------------------------------------------------------------------------
	//
	// Controls engine-level lifecycle/test hooks.
	//
	// Semantics:
	//   hooks === true
	//     → Use the standard test hooks (see testHooks.js).
	//
	//   hooks === false / null / undefined
	//     → No hooks (empty object).
	//
	//   hooks === { ... }
	//     → Treated as a hash of functions.
	//       Shallow merge over defaults (if any).
	//       Only function values are retained.
	//
	// Notes:
	//   - Hooks are NOT deep-filtered like builtins.
	//   - Hook names are not validated at compile time.
	//   - Intended for diagnostics, instrumentation, and testing.
	//
	// ---------------------------------------------------------------------------
	// opResolution
	// ---------------------------------------------------------------------------
	//
	// Controls symbolic operation lookup behavior when pipeline steps are not
	// explicitly marked as builtin.
	//
	// Fields:
	//   order
	//     → Ordered lookup sources for symbolic op names.
	//       Allowed values are "user", "lib", and "builtin".
	//
	//   auto
	//     → When true, non-explicit steps follow `order`.
	//     → When false, non-explicit steps resolve user functions only.
	//
	// Notes:
	//   - Explicit builtin steps bypass ordered fallback and use builtin lookup.
	//   - This policy applies to symbolic op names, not direct function refs.
	//
	// ---------------------------------------------------------------------------

	engine: {
	    builtins: true,
	    hooks: false,
	    opResolution: {
		order: ["user", "lib", "builtin"],
		auto: true,
	    },
	}
    }
);


export default DEFAULT_CONFIG;
