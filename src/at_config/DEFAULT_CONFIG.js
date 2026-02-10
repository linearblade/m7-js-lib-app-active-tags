import freezeDeep from '../helpers/freezeDeep.js';
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
	// m7-lib does a good job of inferring this. you dont really need to configure env.
	// under normal browser environments probably just leave it.
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
	// Logging / diagnostics policy
	// ---------------------------------------------------------------------------
	log: {
	    enabled: true,
	    policy: {
		console: "warn",   // warn | error | info | log (as supported by lib logger)
		trace: false       // pipeline / VM trace output
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
	// Mutation observer
	// ---------------------------------------------------------------------------
	observe: {
	    // enabled intentionally omitted
	    // runtime enablement is controlled by boot.observeDom
	    //selectors: "[data-activetag]", // defaults to boot selector if omitted
	    debounceMs: 25,
	    observeAttributes: false
	},
	// ---------------------------------------------------------------------------
	// Hooks
	// ---------------------------------------------------------------------------
	
	//hooks : true, //true = test hooks , falsy = no hooks , user defined => hash of functions
	// ---------------------------------------------------------------------------
	// Engine
	// ---------------------------------------------------------------------------
	engine : {
	    builtins : true,
	    hooks    : false
	}
    }
);


export default DEFAULT_CONFIG;
