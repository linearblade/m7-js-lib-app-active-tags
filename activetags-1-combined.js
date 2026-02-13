

# --- begin: ActiveTags.js ---

/**
 * ActiveTags
 * ==========
 *
 * PROJECT OVERVIEW
 * ----------------
 * ActiveTags is a declarative, backend-driven runtime for hydrating
 * reusable DOM components.
 *
 * It allows HTML elements to declare behavior through configuration,
 * which is compiled into Jobs and executed through a deterministic Engine.
 *
 * The system separates:
 *
 *   Configuration compilation
 *   DOM discovery and attachment
 *   Job registration
 *   Execution orchestration
 *   Runtime subsystems such as events, intervals, and observation
 *
 * ActiveTags is not a template engine.
 * It is not a virtual DOM framework.
 * It is not a reactive state system.
 *
 * It is a structured execution engine for DOM-bound Jobs.
 *
 *
 * ARCHITECTURAL ROLE
 * ------------------
 * The ActiveTags class is the top-level orchestrator and public API surface.
 *
 * It is responsible for:
 *   Compiling configuration via Schema
 *   Wiring core runtime services
 *   Instantiating subsystem controllers
 *   Exposing public lifecycle methods
 *
 * It delegates execution to:
 *   Engine
 *
 * It delegates DOM discovery to:
 *   DiscoverController
 *
 * It delegates runtime triggers to:
 *   EventController
 *   IntervalController
 *   ObserverController
 *
 *
 * SUBSYSTEM COMPOSITION
 * ---------------------
 * After construction, the instance exposes:
 *
 *   this.engine
 *   this.jobs
 *   this.events
 *   this.intervals
 *   this.observer
 *   this.discover
 *
 * Each subsystem is independently responsible for its own runtime behavior.
 *
 *
 * CONFIGURATION MODEL
 * -------------------
 * Configuration is compiled transactionally by atSchema.
 * The compiled configuration snapshot is stored on:
 *
 *   this.conf
 *
 * Runtime subsystems must treat this configuration as authoritative.
 *
 *
 * LIFECYCLE
 * ---------
 * Construction performs:
 *   Configuration compilation
 *   Service resolution
 *   Subsystem instantiation
 *
 * Calling start() performs:
 *   Initial DOM scan
 *   Optional observer activation
 *   Event and interval registration
 *   Optional runtime enablement
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * ActiveTags must remain:
 *   A thin orchestrator
 *   Execution-agnostic outside of Engine
 *   Deterministic in configuration
 *   Clear in subsystem boundaries
 *
 *
 * PUBLIC API SURFACE
 * ------------------
 * Core lifecycle:
 *   start()
 *
 * Convenience helpers:
 *   enqueueAll(reason)
 *
 * Job interaction helpers:
 *   Provided via trait_job
 *
 *
 * EXTENSIBILITY
 * -------------
 * New runtime subsystems should be implemented as controllers
 * and injected during construction.
 *
 * Public API additions should remain minimal and explicit.
 */

import applyMixins from './helpers/applyMixins.js';
//import requireLibs from './helpers/requireLibs.js';

import trait_job          from './traits/job.js';
import trait_eng          from './traits/engine.js';

import JobRegistry        from './class/job/Registry.js';
import CONSTANTS          from './constants.js';
import ExpressionResolver from './class/expressions/ExpressionResolver.js';
import Engine             from './class/engine/Engine.js';

import IntervalController from './class/interval/Controller.js';
import ObserverController from './class/observer/Controller.js';
import EventController    from './class/event/Controller.js';
import DiscoverController from './class/discover/Controller.js';

import atSchema           from './at_config/Schema.js';
import DEFAULT_CONFIG     from './at_config/DEFAULT_CONFIG.js';
class ActiveTags {
    /**
     * Construct an ActiveTags runtime instance.
     *
     * Contract:
     * - Compiles top-level runtime config from defaults + user overrides.
     * - Resolves required m7 dependencies/services.
     * - Instantiates runtime subsystems (registry, engine, controllers).
     * - Does not start scanning/listening/executing until `start()` is called.
     *
     * @param {Object} lib
     * Required m7 lib instance.
     *
     * @param {Object} [conf={}]
     * Optional user configuration merged over `DEFAULT_CONFIG`.
     *
     * @throws {Error}
     * If `lib` is missing or required services/dependencies cannot be resolved.
     */
    constructor(lib, conf = {}) {
	if (!lib) {
            throw new Error('[activeTags] constructor requires lib as first argument');
	}
	this.schema = new atSchema({lib, def_conf:DEFAULT_CONFIG, user_conf: conf});
	this.opts = this.conf   = this.schema.snapShot();
	console.log(this.conf);

	// allow helpers to assume this.lib exists
	this.lib = lib;
	
	// minimal require so we can normalize config
	lib.require.all(CONSTANTS.LIB_HASH, { mod: '[activeTags]' });


	lib.require.all(CONSTANTS.CORE_DEPS ,                    { mod: '[activeTags]' } );
	const svc = lib.require.service(CONSTANTS.CORE_SERVICES, { mod: '[activeTags]', returnMap: true } );
	// external managers (injected, non-owning)
	this.svc = {};
	// now you can tie them to semantic slots safely
	this.svc.delegator       = svc[CONSTANTS.SERVICE_DELEGATOR] || null;
	this.svc.interval        = svc[CONSTANTS.SERVICE_INTERVAL] || null;
	this.svc.log             = svc[CONSTANTS.SERVICE_LOG] || null;
	this.svc.domObserver     = svc[CONSTANTS.SERVICE_OBSERVER] || null;


	if (this.svc.log && this.conf.log.enabled) {
	    for (const key in this.conf.log.buckets) {
		console.log(` creating ${key} `,this.conf.log.policy);
		this.svc.log.createBucket(this.conf.log.buckets[key], this.conf.log.policy);
	    }
	}
	/*
	  this.svc.interval.opts.onEvent = (ev) => {
	  console.log("[IM]", ev.type, ev.name, ev.reason || "", ev.message || "");
	  };*/
	

	
	this.expr = new ExpressionResolver({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    logger: this.logger,
	    env: this.conf.env
	});

	
	// runtime state
	this.jobCounter = 0;

	// workspace + scheduler
	this.ws = new lib.primitive.workspace.WorkSpace();

	this.jobs = new JobRegistry({ lib , conf: this.conf.job, env:this.conf.env});

	// options (delegated)
	//this.engine = new Engine({lib,jobRegistry: this.jobs});

	this.engine = new Engine({
	    lib,
	    jobRegistry  : this.jobs,
	    conf         : this.conf.engine,
	    expr         : this.expr
	});

	this.intervals = new IntervalController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	});

	//const first = lib.array.to(CONSTANTS.DEFAULT_SELECTOR)[0];
	this.events = new EventController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	    selector: this.conf.boot.selector
	});

	this.observer = new ObserverController({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	});
	
	this.discover = new DiscoverController({
	    AT: this,
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	});
	
    }


    /**
     * Initialize the ActiveTags runtime.
     *
     * CONTRACT
     * --------
     * start() performs initial DOM discovery and activates runtime subsystems
     * according to boot configuration.
     *
     * It does not execute pipelines directly.
     * It does not enqueue autorun jobs.
     * It does not mutate job configuration.
     *
     * This method is intended to be called once during application boot.
     *
     *
     * PRECONDITIONS
     * -------------
     * A valid document must exist at lib._env.root.document.
     * The document must expose a body element.
     *
     * Throws if the runtime environment does not provide a usable document.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Validates that a usable document exists.
     * 2. Performs an initial DOM scan via DiscoverController.scan().
     * 3. If boot.observeDom is enabled, starts the ObserverController.
     * 4. Registers interval and event definitions for all Jobs.
     * 5. Enables intervals and events if boot flags allow.
     *
     *
     * CONFIGURATION GATES
     * -------------------
     * The following boot flags control runtime activation:
     *
     *   boot.observeDom
     *   boot.intervals
     *   boot.events
     *
     * Each flag defaults to enabled unless explicitly disabled.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May register new Jobs during DOM discovery.
     * May activate DOM observation.
     * May attach interval handlers.
     * May attach event handlers.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not automatically enqueue autorun pipelines.
     * Does not drain the Engine.
     * Does not reconcile previously removed DOM elements.
     *
     *
     * DESIGN NOTES
     * ------------
     * start() acts as the runtime activation boundary.
     * Configuration compilation must already be complete.
     * Subsystem instantiation must already be complete.
     */
    async start() {
	const lib = this.lib;

	const doc = lib.hash.get(lib, '_env.root.document');
	if (!doc || !doc.body)
            throw new Error("cannot start, active tags missing doc or doc body");

	// discovery (controller-owned)
	await this.discover.scan();

	if (!lib.bool.no(this.conf.boot.observeDom))
            this.observer.start();

	this.intervals.registerAll();
	this.events.registerAll();

	// on by default; falsy disables
	if (!lib.bool.no(this.conf.boot.intervals))
            this.intervals.on();

	if (!lib.bool.no(this.conf.boot.events))
            this.events.on();
    }
}


/**
 * Mixin Composition
 * -----------------
 *
 * applyMixins() extends the ActiveTags prototype with selected
 * trait modules.
 *
 * PURPOSE
 * -------
 * Traits are used here strictly as organizational helpers.
 * They allow large public method groups to be defined in
 * separate files without inflating the main class definition.
 *
 *
 * ARCHITECTURAL INTENT
 * --------------------
 * Traits used at this level must represent:
 *
 *   Public API helpers
 *   Stateless convenience methods
 *   Logic that does not require independent lifecycle management
 *
 * Traits must not:
 *
 *   Act as runtime subsystems
 *   Maintain internal state
 *   Register listeners
 *   Bind external services
 *
 * Subsystems with lifecycle responsibilities must be implemented
 * as controllers and instantiated explicitly in the constructor.
 *
 *
 * CURRENT TRAITS
 * --------------
 * trait_job
 *   Job-related helper methods that do not require config dependencies.
 *
 * trait_eng
 *   Public runtime convenience helpers such as enqueueAll().
 *
 *
 * DESIGN CONSTRAINT
 * -----------------
 * Traits are reserved for API surface organization only.
 * If a trait grows into a stateful or lifecycle-driven unit,
 * it must be refactored into a controller.
 */
applyMixins(
    ActiveTags,
    trait_job,   // no config deps
    trait_eng
);
export { ActiveTags };
export default ActiveTags;


# --- end: ActiveTags.js ---



# --- begin: at_config/DEFAULT_CONFIG.js ---

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
	// The `engine` block defines the functional surface exposed to the runtime
	// execution engine (builtins + hooks).
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

	engine: {
	    builtins: true,
	    hooks: false
	}
    }
);


export default DEFAULT_CONFIG;


# --- end: at_config/DEFAULT_CONFIG.js ---



# --- begin: at_config/LAST_LINE_DEFAULTS.js ---

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


# --- end: at_config/LAST_LINE_DEFAULTS.js ---



# --- begin: at_config/Schema.js ---

// at_config/Schema.js
/**
 * ActiveTags Configuration Schema
 * -------------------------------
 *
 * Canonical configuration compiler for ActiveTags runtime configuration.
 *
 * Purpose:
 * - Normalize, merge, and validate configuration inputs into a single
 *   deterministic runtime configuration object.
 * - Establish clear precedence rules between defaults, user config,
 *   and system safety nets.
 *
 * This module is not:
 * - A JSON Schema
 * - A runtime controller
 * - A configuration loader
 * - A validation framework that enforces business semantics
 *
 * This module does:
 * - Accepts factory defaults (`def_conf`)
 * - Accepts optional user configuration
 * - Compiles configuration transactionally into `active`
 * - Guarantees stable shapes and types for downstream systems
 *
 * Configuration sources (high level):
 *   1) Factory defaults (def_conf)
 *   2) User configuration (constructor / merge input)
 *   3) Constants (final safety net only)
 *
 * Design principles:
 * - Deterministic: same inputs always produce the same output
 * - Transactional: no partial state is committed on failure
 * - Declarative: normalize first, interpret later
 * - Side-effect free: no DOM access, I/O, timers, or services
 *
 * LIFECYCLE:
 * - Constructor performs an initial safe compile from defaults
 * - `merge()` recompiles configuration on demand
 * - `reset()` restores factory defaults without recompilation
 *
 * RUNTIME SEPARATION:
 * - This module ONLY compiles configuration.
 * - Runtime behavior (events, intervals, observers, pipelines)
 *   is handled elsewhere.
 * - This module only compiles their configuration blocks.
 *
 * AUDIENCE:
 * - Core maintainers
 * - Contributors adding new configuration fields
 * - Anyone needing to understand how config precedence works
 *
 * Expectations for contributors:
 * - New config fields must be normalized here
 * - Do NOT introduce runtime behavior into this module
 * - Constants may be used ONLY as final safety nets
 */
import CONSTANTS  from "../constants.js"; 
import LAST_LINE  from "./LAST_LINE_DEFAULTS.js"; 
import testHooks  from "../class/engine/testHooks.js";
import builtins   from '../builtins/index.js';
import freezeDeep from '../helpers/freezeDeep.js';

export default class Schema {
    /**
     * Create a new configuration Schema compiler for ActiveTags.
     *
     * CONTRACT:
     * - Requires `lib` and `def_conf` to be provided.
     * - Initializes internal state (`active`, `user_conf`) and immediately performs
     *   an initial compilation using `merge(user_conf, true)`.
     * - After construction, `this.active` will always contain a valid compiled
     *   configuration (unless the initial merge throws).
     *
     * REQUIRED INPUTS:
     * - `lib`:
     *   The m7 lib instance providing normalization primitives (hash/array/bool/utils).
     * - `def_conf`:
     *   The default system configuration object (factory defaults).
     *   This is treated as the authoritative baseline for compilation.
     *
     * OPTIONAL INPUTS:
     * - `user_conf`:
     *   Optional user configuration overrides merged on top of defaults.
     *
     * BEHAVIOR:
     * - Stores references to `lib` and `def_conf`.
     * - Initializes `active` and `user_conf` to null.
     * - Calls `merge(user_conf, true)`:
     *     - Normalizes user input
     *     - Rebuilds from defaults (safe path)
     *     - Commits `active` and `user_conf` atomically on success
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT perform runtime side effects (no DOM operations, observers, events).
     * - Does NOT load external configs (DOM/script config loading occurs elsewhere).
     *
     * FAILURE MODE:
     * - Throws immediately if `lib` or `def_conf` is missing.
     * - Re-throws any errors that occur during initial `merge`.
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *   Required m7 lib instance.
     *
     * @param {Object|null} [opts.user_conf=null]
     *   Optional user configuration overrides to apply during initial compile.
     *
     * @param {Object|null} opts.def_conf
     *   Required default system configuration (factory defaults).
     *
     * @throws {Error}
     *   If required arguments are missing or initial compilation fails.
     */
    constructor({ lib, user_conf = null, def_conf = null } = {}) {
	if (!lib) throw new Error("lib must be passed in");
	if (!def_conf) throw new Error("default system configuration must exist");

	this.lib = lib;
	this.def = def_conf;

	this.active = null;     // last successfully compiled config
	this.user_conf = null;  // last user config seen (normalized)

	// initial compile from defaults + optional user config
	this.merge(user_conf, true);
    }

    /**
     * Merge user configuration into a compiled "active" configuration object.
     *
     * CONTRACT:
     * - Builds configuration transactionally:
     *   - Compilation occurs into a local `next` object.
     *   - `this.active` and `this.user_conf` are updated ONLY on success.
     * - Produces a deterministic, normalized configuration suitable for runtime use.
     * - Throws if compilation fails (no partial state is committed).
     *
     * INPUT NORMALIZATION:
     * - `conf` is normalized to a hash via `lib.hash.to(conf)`.
     * - `reset` is normalized using lib boolean semantics:
     *     reset = !lib.bool.no(reset)
     *
     * STARTING BASE (reset semantics):
     * - reset === true  (default):
     *     Build starts from a deep copy of factory defaults (`this.def`).
     * - reset === false (advanced / overlay):
     *     Build starts from a deep copy of the current compiled config (`this.active`),
     *     falling back to `this.def` if no active config exists.
     *
     * COMPILE ORDER (deterministic):
     *   1) _configEnv
     *   2) _configJob
     *   3) _configEngine
     *   4) _configBoot
     *   5) _configObserve
     *   6) _configLog
     *   7) _configErrors
     *
     * RESPONSIBILITIES:
     * - Normalize user config input.
     * - Select the correct starting base configuration (defaults vs active overlay).
     * - Execute schema compilation passes in a stable order.
     * - Commit compiled results atomically.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT perform runtime side effects (no DOM access, observers, events, intervals).
     * - Does NOT perform I/O or external config loading (that occurs elsewhere).
     * - Does NOT swallow compilation errors.
     *
     * OUTPUT GUARANTEES:
     * - On success:
     *     - `this.active` is a fully compiled, normalized config.
     *     - `this.user_conf` is the normalized user input that produced `this.active`.
     * - On failure:
     *     - `this.active` remains unchanged.
     *     - `this.user_conf` remains unchanged.
     *
     * @param {Object} conf
     *   User configuration input. May be null/undefined or non-object; it will be
     *   coerced to a hash via `lib.hash.to`.
     *
     * @param {boolean} reset
     *   Reset control:
     *     - true  => rebuild from defaults (default, safe)
     *     - false => overlay on existing active config (advanced usage)
     *   Normalized using `lib.bool.no`.
     *
     * @returns {Object}
     *   The compiled active configuration object.
     *
     * @throws {Error}
     *   Re-throws any errors encountered during compilation. No partial config is committed.
     */
    merge(conf = null, reset = true) {
	const { lib } = this;
	reset = !lib.bool.no(reset);
	const user = lib.hash.to(conf);


	// transactional build target (commit only on success)
	let next;

	try {
	    next = reset
		? lib.utils.deepCopy(this.def)
		: lib.utils.deepCopy(this.active || this.def);

	    // deterministic compile order
	    this._configEnv(next, user);
	    this._configJob(next, user);
	    this._configEngine(next, user);    
	    this._configBoot(next, user);
	    this._configObserve(next, user); 
	    this._configLog(next, user);
	    this._configErrors(next, user);

	} catch (err) {
	    // nothing committed yet; leave this.active unchanged
	    throw err;
	}


	// only copy user conf on successful build
	this.user_conf = user;
	
	this.active = next;
	return this.active;
    }
    
    /**
     * Return a detached snapshot of the currently compiled configuration.
     *
     * CONTRACT:
     * - Does NOT mutate Schema state.
     * - Returns a deep copy of `this.active` (callers cannot mutate internal state).
     *
     * SEMANTICS:
     * - Primary read surface for compiled config.
     * - Does not recompile (use `merge()` to rebuild).
     * - Optional best-effort deep-freeze:
     *     - If `freeze === true`, attempts `freezeDeep(snapshot)`.
     *     - If deep-freeze fails (unfreezable objects), returns the unfrozen snapshot.
     *
     * RESPONSIBILITIES:
     * - Provide a stable, detached view of the active compiled config.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT validate runtime capability.
     * - Does NOT guarantee the snapshot is frozen even when `freeze === true`.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.freeze=false]
     *   If true, best-effort deep-freeze the returned snapshot.
     *
     * @returns {Object}
     *   Detached deep copy of the current compiled configuration.
     *
     * @throws {Error}
     *   If no active config exists to snapshot.
     */
    snapShot({ freeze = false } = {}) {
	const { lib } = this;

	if (!this.active) {
	    throw new Error("Schema.snapShot(): no active config to snapshot");
	}

	const out = lib.utils.deepCopy(this.active);
	//$fixup. current freeze deep WILL throw b/c it doesnt handle certain unfreezable objects
	if (freeze) {
	    try { return freezeDeep(out); }
	    catch { return out; }
	}

	return out;
    }
    
    /**
     * Reset the active configuration to factory defaults.
     *
     * CONTRACT:
     * - Mutates `this.active` directly.
     * - Discards any previously compiled or merged configuration.
     * - Does NOT read or apply user configuration.
     * - Does NOT perform schema compilation steps.
     *
     * SEMANTICS:
     * - This is a hard reset to `def_conf` only.
     * - Equivalent to creating a brand-new Schema instance
     *   without providing user configuration.
     *
     * RELATION TO `merge()`:
     * - `reset()` is an explicit, imperative operation.
     * - `merge(conf, true)` performs a *rebuild* from defaults
     *   while applying user configuration.
     * - `reset()` performs no merge and no validation beyond cloning.
     *
     * RESPONSIBILITIES:
     * - Restore `this.active` to a deep copy of the default configuration.
     * - Provide a clean baseline for subsequent `merge()` calls.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT normalize or validate configuration blocks.
     * - Does NOT update `this.user_conf`.
     * - Does NOT trigger any runtime behavior.
     *
     * @returns {Object}
     *   The newly reset active configuration object.
     */
    reset() {
	// factory reset (explicit)
	this.active = this.lib.utils.deepCopy(this.def);
	return this.active;
    }

    // ---------------------------------------------------------------------------
    // "Private" block compilers (by convention)
    // ---------------------------------------------------------------------------

    // ---------------------------------------------------------------------------
    // Env
    // ---------------------------------------------------------------------------
    /**
     * Compile and normalize the `env` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.env` in-place.
     * - Delegates all environment derivation logic to `_makeEnv`.
     * - Produces a canonical, environment descriptor for runtime use.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Environment inferred from `lib._env` and globals
     *   2) User-provided environment (`user.env`)
     *
     * RESPONSIBILITIES:
     * - Extract the `env` subtree from user configuration.
     * - Invoke environment normalization and derivation.
     * - Assign the resulting canonical environment object to `active.env`.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT validate DOM availability.
     * - Does NOT start observers or access the DOM.
     * - Does NOT mutate global objects or `lib._env`.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.env` will be a canonical environment object
     * as returned by `_makeEnv`, with the shape:
     *
     *   {
     *     root: any|null,
     *     window: any|null,
     *     document: any|null,
     *     baseURI: string|null
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.env` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain an `env` subtree.
     */ 
    _configEnv(active, user) {
	const inEnv = user && user.env;
	active.env = this._makeEnv(inEnv);
    }
    /**
     * Derive and normalize the execution environment descriptor.
     *
     * CONTRACT:
     * - Pure w.r.t. Schema state (reads `this.lib`, does not mutate Schema fields).
     * - Does NOT touch `active`/`user`; operates only on the provided `inEnv` input.
     * - Returns a canonical `{ root, window, document, baseURI }` object.
     * - Does not intentionally throw (best-effort derivation; missing parts become `null`).
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Implicit globals (`globalThis`)
     *   2) `lib._env` (supports legacy + modern layouts)
     *   3) Explicit caller overrides (`inEnv`)
     *
     * DERIVATION RULES:
     * - `root` is resolved first:
     *     inEnv.root → inEnv.window → lib._env.root → globalThis → null
     * - `window` is resolved next:
     *     inEnv.window → root.window → root → null
     * - `document` is resolved next:
     *     inEnv.document → window.document → null
     * - `baseURI` is resolved last:
     *     inEnv.baseURI → document.baseURI → null
     *
     * RESPONSIBILITIES:
     * - Coerce `inEnv` to a hash (non-objects ignored).
     * - Tolerate partial environments (non-browser contexts).
     * - Provide stable references used by DOM-facing runtime subsystems.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT verify browser capability (MutationObserver, querySelectorAll, etc.).
     * - Does NOT access the DOM or start services.
     * - Does NOT mutate `lib`, globals, or any runtime objects.
     *
     * OUTPUT GUARANTEES:
     * - Always returns an object with keys:
     *     { root:any|null, window:any|null, document:any|null, baseURI:string|null }
     *
     * @param {Object} [inEnv]
     *   Optional environment override. Non-object values are ignored.
     *
     * @returns {Object}
     *   Canonical environment descriptor.
     */
    _makeEnv(inEnv = {}) {
	const lib = this.lib;

	// Normalize caller env
	inEnv = lib && lib.hash && lib.hash.is(inEnv) ? inEnv : {};

	// Pull lib env (legacy + modern)
	const libEnv =
	      (lib && (lib._env || (lib.hash && lib.hash.get(lib, "_env")))) || {};

	const libRoot =
	      libEnv.root ||
	      (lib && lib.hash && lib.hash.get(lib, "_env.root")) ||
	      null;

	// Canonical derivation
	const root =
	      inEnv.root ||
	      inEnv.window ||
	      libRoot ||
	      (typeof globalThis !== "undefined" ? globalThis : null);

	const windowRef =
	      inEnv.window ||
	      (root && root.window) ||
	      root ||
	      null;

	const documentRef =
	      inEnv.document ||
	      (windowRef && windowRef.document) ||
	      null;

	const baseURI =
	      inEnv.baseURI ||
	      (documentRef && documentRef.baseURI) ||
	      null;

	return {
	    root,          // globalThis / window / global
	    window: windowRef,
	    document: documentRef,
	    baseURI,
	};
    }

    /**
     * Compile and normalize the `job` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.job` in-place.
     * - Acts as a delegation layer for job-related schema compilation.
     * - Exists to preserve structure and ordering for future job-level config.
     *
     * RESPONSIBILITIES:
     * - Invoke job configuration compilation in the correct schema phase.
     * - Provide a stable hook point for future job-wide options
     *   (e.g., job behavior flags, lifecycle controls, defaults).
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT directly normalize job configuration fields.
     * - Does NOT execute job logic or runtime behavior.
     *
     * DESIGN NOTE:
     * - This method intentionally delegates to `_configJobConfig`.
     * - Keeping this layer allows additional job-level schema handling
     *   to be added later without changing the schema orchestration order.
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method may mutate `active.job` via delegated calls.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     */
    _configJob(active, user) {
	this._configJobConfig(active, user);
	this._configJobRegistry(active, user);
    }
    /**
     * Compile and normalize the `job.config` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.job.config` in-place.
     * - Establishes the canonical job-configuration *policy* used by the runtime
     *   when compiling per-job configs later.
     * - Ensures stable shapes/types for downstream consumers.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.job.config`)
     *   2) User overrides (`user.job.config`) merged over defaults (MERGE_OPTS_V1)
     *   3) LAST_LINE safety nets (applied only if required fields remain missing/invalid)
     *
     * BASE SEMANTICS:
     * - `job.config.base` is treated as seed data and is only shape-coerced here.
     * - If the user provides `user.job.config.base`, it overrides `cfg.base` via the
     *   `user.job.config` merge (no special handling beyond merge semantics).
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `job`, `job.config`, and nested objects are hashes)
     * - Deterministic merge of `user.job.config` over defaults
     * - Normalize list-like fields to `string[]` (filter + trim-guard)
     * - Apply LAST_LINE fallbacks for required fields:
     *     - `at` (from LAST_LINE.DOM_CONFIG_AT)
     *     - `evalType` (from LAST_LINE.DEFAULT_EVAL_TYPE)
     * - Normalize merge policy defaults (`merge.order`, `merge.objects`, `merge.arrays`)
     * - Boolean normalization of `allowExternal`
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT load/read external configs (DOM/script/import)
     * - Does NOT parse or execute eval/import content
     * - Does NOT validate business semantics beyond type/shape guarantees
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.job.config` will satisfy (minimum contract):
     *
     *   {
     *     allowExternal: boolean,      // default true unless explicitly disabled
     *     at: string[],               // non-empty (LAST_LINE fallback)
     *     attrPrefixes: string[],      // non-empty (fallback ["data-","at-"])
     *     evalType: string[],          // non-empty (LAST_LINE fallback)
     *     importPath: string[],        // may be empty
     *     capture_attrs: string[],     // may be empty
     *     merge: {
     *       order: string[],           // non-empty (fallback ["base","external","inline"])
     *       objects: string,           // fallback "deep"
     *       arrays: string             // fallback "concatUnique"
     *     },
     *     base: Object                 // always a hash/object
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.job.config` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain `job.config`.
     */
    _configJobConfig(active, user) {
	const { lib } = this;

	// Ensure structure exists (def_conf should provide it, but be defensive)
	active.job = lib.hash.to(active.job);
	active.job.config = lib.hash.to(active.job.config);

	const cfg = active.job.config;

	// -----------------------------------------
	// 1) Normalize base objects
	// -----------------------------------------
	// NOTE: `job.config.base` is runtime job-config seed data.
	// Schema only coerces shape here (no aliasing / no hidden overrides).
	cfg.base = lib.hash.to(cfg.base);

	// -----------------------------------------
	// 2) Merge explicit user.job.config over defaults
	// -----------------------------------------
	const userJobCfg = lib.hash.to(lib.hash.get(user, "job.config"));

	// Explicit job.config overrides everything in cfg (including fields other than base)
	// NOTE: if user passes `base`, it overrides the current cfg.base
	active.job.config = lib.hash.merge(cfg, userJobCfg, CONSTANTS.MERGE_OPTS_V1);

	// Re-grab after potential replacement
	const out = active.job.config;

	// -----------------------------------------
	// 3) Final safety-net defaults from constants (only if missing)
	// -----------------------------------------

	// at pointers: default from LAST_LINE.DOM_CONFIG_AT ("config.at at")
	out.at = lib.array.to(out.at, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.at))
            out.at = lib.array.to(LAST_LINE.DOM_CONFIG_AT, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");

	// attrPrefixes
	out.attrPrefixes = lib.array.to(out.attrPrefixes, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.attrPrefixes))
            out.attrPrefixes = ["data-", "at-"];

	// evalType
	out.evalType = lib.array.to(out.evalType, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.evalType))
            out.evalType = LAST_LINE.DEFAULT_EVAL_TYPE;

	// importPath
	out.importPath = lib.array.to(out.importPath, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");

	// merge policy defaults (baseline only; richer semantics can be added later)
	out.merge = lib.hash.to(out.merge);

	out.merge.order = lib.array.to(out.merge.order, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.merge.order)) out.merge.order = ["base", "external", "inline"];

	if (!out.merge.objects) out.merge.objects = "deep";
	if (!out.merge.arrays)  out.merge.arrays  = "concatUnique";

	// allowExternal default (if somehow missing)
	out.allowExternal = !lib.bool.no(out.allowExternal);

	out.capture_attrs = lib.array.to(out.capture_attrs, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === 'string');
	
	// Ensure base always ends up a hash
	out.base = lib.hash.to(out.base);
    }
    

    /**
     * Compile and normalize the `job.registry` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.job.registry` in-place.
     * - Defines JobRegistry wiring/config only (not job config policy).
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.job.registry`)
     *   2) User-provided configuration (`user.job.registry`)
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `job` and `job.registry` are objects)
     * - Deterministic merge of user overrides (MERGE_OPTS_V1)
     * - Apply final safety-net defaults for required fields
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT create the JobRegistry
     * - Does NOT register/unregister jobs
     * - Does NOT validate semantics beyond basic type/shape guarantees
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.job.registry` will satisfy:
     *
     *   {
     *     prefix: string   // non-empty, trimmed, defaults to "at"
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.job.registry` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain a `job.registry` subtree.
     */
    _configJobRegistry(active, user) {
	const { lib } = this;

	// ensure structure
	active.job = lib.hash.to(active.job);
	active.job.registry = lib.hash.to(active.job.registry);

	// merge user.job.registry over defaults
	const userReg = lib.hash.to(lib.hash.get(user, "job.registry"));
	active.job.registry = lib.hash.merge(active.job.registry, userReg, CONSTANTS.MERGE_OPTS_V1);

	const reg = active.job.registry;

	// safety net
	reg.prefix = (typeof reg.prefix === "string" && reg.prefix.trim())
	    ? reg.prefix.trim()
	    : "at";
    }
    
    /**
     * Compile and normalize the `boot` configuration block.
     *
     * RUNTIME SEPARATION:
     * - This method ONLY compiles boot-time configuration.
     * - It does NOT start/stop any subsystems (sweep, observer, events, intervals).
     * - Actual boot execution is handled by the ActiveTags runtime layer.
     *
     * CONTRACT:
     * - Mutates `active.boot` in-place.
     * - Establishes boot-time policy and initial runtime enablement intent only.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.boot`)
     *   2) User-provided configuration (`user.boot`)
     *
     * SAFETY NET:
     * - Missing/invalid fields are replaced with safe defaults.
     * - LAST_LINE defaults are used only as a final fallback.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `boot` is an object)
     * - Deterministic merge of user overrides (MERGE_OPTS_V1)
     * - Normalize `boot.selector` into a non-empty `string[]`
     * - Normalize boolean flags with "default true unless explicitly disabled"
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute boot actions (discover/sweep, observe, enable subsystems)
     * - Does NOT validate selector correctness beyond basic type checks
     * - Does NOT manage runtime state after initialization
     *
     * SEMANTICS:
     * - Boolean flags default to `true` unless explicitly disabled via `lib.bool.no(...)`.
     * - `intervals` and `events` express initial runtime enablement intent only;
     *   they may be changed later via runtime APIs.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.boot` will satisfy:
     *
     *   {
     *     selector: string[],     // non-empty, trimmed strings
     *     bootSweep: boolean,     // default true
     *     observeDom: boolean,    // default true
     *     intervals: boolean,     // default true
     *     events: boolean         // default true
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.boot` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain a `boot` subtree.
     */
_configBoot(active, user) {
    const { lib } = this;

    // ensure structure
    active.boot = lib.hash.to(active.boot);

    // merge user.boot over defaults
    const userBoot = lib.hash.to(lib.hash.get(user, "boot"));
    active.boot = lib.hash.merge(active.boot, userBoot, CONSTANTS.MERGE_OPTS_V1);

    const boot = active.boot;

    const normSelectors = (val) => lib.array
        .to(val, CONSTANTS.ARR_TO_OPTS)
        .filter(v => typeof v === "string" && v.trim())
        .map(v => v.trim());

    // ---- selector (required; string OR string[]) ----
    boot.selector = normSelectors(boot.selector);

    // safety-net fallback
    if (!lib.array.len(boot.selector)) {
        boot.selector = normSelectors(LAST_LINE.DEFAULT_SELECTOR);
    }

    if (!lib.array.len(boot.selector)) {
        throw new Error(
            "Schema._configBoot(): boot.selector is required and must be a non-empty string or string[]"
        );
    }

    // ---- flags ----
    boot.bootSweep  = !lib.bool.no(boot.bootSweep);
    boot.observeDom = !lib.bool.no(boot.observeDom);

    // initial runtime enablement flags (boot-time only)
    boot.intervals  = !lib.bool.no(boot.intervals);
    boot.events     = !lib.bool.no(boot.events);
}
    
    
    /**
     * Compile and normalize the `log` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.log` in-place.
     * - Defines logging/diagnostics policy only.
     * - Does NOT create logger instances or bind to services.
     * - Does NOT emit logs or perform runtime side effects.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.log`)
     *   2) User-provided configuration (`user.log`)
     *
     * SAFETY NET:
     * - Missing or invalid fields are replaced with sane defaults.
     * - LAST_LINE defaults are used only as a final fallback.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `log`, `log.policy`, and `log.buckets` are objects)
     * - Deterministic merge of user overrides (MERGE_OPTS_V1)
     * - Boolean normalization of `enabled`
     * - Boolean normalization of `policy.trace`
     * - Fallback normalization of `policy.console`
     * - Ensure `buckets` is a hash of string values (deep-copied, filtered)
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT validate the full range of logging policy values
     * - Does NOT enforce bucket naming conventions
     * - Does NOT bind or create buckets in the logger service
     * - Does NOT interpret or execute logging behavior
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.log` will satisfy (minimum contract):
     *
     *   {
     *     enabled: boolean,
     *     policy: {
     *       console: string,
     *       trace: boolean
     *     },
     *     buckets: {
     *       [key: string]: string   // string values only
     *     }
     *   }
     *
     * `buckets` is always a plain object with string values only.
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.log` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain a `log` subtree.
     */
    _configLog(active, user) {
	const { lib } = this;

	// ensure structure
	active.log = lib.hash.to(active.log);

	// merge user.log over defaults (if provided)
	const userLog = lib.hash.to(lib.hash.get(user, "log"));
	active.log = lib.hash.merge(active.log, userLog, CONSTANTS.MERGE_OPTS_V1);

	const log = active.log;

	// ---- final safety-net defaults ----

	// enabled flag
	//default true
	log.enabled = !lib.bool.no(log.enabled);

	// policy object
	log.policy = lib.hash.to(log.policy);

	// console policy (fallback to constants)
	//$fixup - go dig up the console policy range later
	if (!log.policy.console) 
	    log.policy.console = lib.hash.get(LAST_LINE, "LOG_POLICY.console", "warn") ;
	

	// trace flag
	log.policy.trace = lib.bool.yes(log.policy.trace) ;
	if (!lib.hash.is(log.buckets) ) log.buckets = LAST_LINE.LOG_BUCKETS_DEFAULT_VALUES;
	log.buckets = lib.utils.deepCopy(lib.hash.filter( lib.hash.to(log.buckets) , (v)=> typeof v === 'string' ) );
    }

    /**
     * Compile and normalize the `errors` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.errors` in-place.
     * - Does NOT throw unless underlying lib helpers throw.
     * - Does NOT validate semantic correctness of error policies.
     * - Ensures a stable, well-typed `errors` object is always produced.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.errors`)
     *   2) User-provided configuration (`user.errors`)
     *
     * SAFETY NET:
     * - If required fields are missing or invalid after merge,
     *   final defaults are applied.
     * - Constants are NOT required here; defaults are inline.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `errors` is an object)
     * - Deterministic merge of user overrides
     * - Type normalization of known fields
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT enforce allowed enum values beyond basic type checks
     * - Does NOT trigger logging, reporting, or runtime behavior
     * - Does NOT interpret or execute error policy
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.errors` will satisfy:
     *
     *   {
     *     onOpError: string   // always present, trimmed, defaults to "error"
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *   This method mutates `active.errors` directly.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     *   May or may not contain an `errors` subtree.
     */
    _configErrors(active, user) {
	const { lib } = this;

	// ensure structure
	active.errors = lib.hash.to(active.errors);

	// merge user.errors over defaults (if provided)
	const userErrors = lib.hash.to(lib.hash.get(user, "errors"));
	active.errors = lib.hash.merge(active.errors, userErrors,CONSTANTS.MERGE_OPTS_V1);

	const errs = active.errors;

	// ---- final safety-net defaults ----

	// onOpError policy
	// allowed values are system-defined; schema only ensures presence/type
	if (typeof errs.onOpError !== "string" || !errs.onOpError.trim()) {
	    errs.onOpError = "error";
	} else {
	    errs.onOpError = errs.onOpError.trim();
	}
    }

    /**
     * Compile and normalize the `observe` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.observe` in-place.
     * - Defines policy/config for the DOM mutation observer service.
     * - Runtime enablement is controlled elsewhere (`boot.observeDom`).
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.observe`)
     *   2) User-provided configuration (`user.observe`)
     *
     * KEY SEMANTICS:
     * - `observe.selector` is OPTIONAL and intentionally decoupled from discovery.
     *   - If omitted or empty, runtime fallback to `boot.selector` is handled
     *     by the ObserveController (not here).
     *   - Schema does NOT alias or copy `boot.selector` into `observe.selector`.
     *
     * - `observe.attribute_filter` defines which attribute changes trigger
     *   re-evaluation when `observeAttributes` is enabled.
     *   - This list MUST be non-empty after compilation.
     *   - If missing/empty, a LAST_LINE default is applied.
     *   - For correct behavior, it should generally include attributes referenced
     *     by the selector(s). See DomChangeObserver documentation.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `observe` is an object)
     * - Deterministic merge of user overrides (MERGE_OPTS_V1)
     * - Normalize `selector` to `string[]` (may be empty)
     * - Normalize `attribute_filter` to `string[]` (guaranteed non-empty after compile)
     * - Normalize `debounceMs` to integer >= 0 (default 25)
     * - Normalize `observeAttributes` to boolean (lib semantics)
     * - Apply LAST_LINE safety-net for `attribute_filter`
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT start/stop the observer service
     * - Does NOT validate CSS selector correctness
     * - Does NOT reconcile existing DOM state (handled by discover/boot sweep)
     * - Does NOT alias discovery selectors into observation selectors
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.observe` will satisfy:
     *
     *   {
     *     selector: string[],         // may be empty; runtime may fall back to boot.selector
     *     attribute_filter: string[], // guaranteed non-empty
     *     debounceMs: number,         // integer >= 0
     *     observeAttributes: boolean  // normalized boolean
     *   }
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     */
    _configObserve(active, user) {
	const { lib } = this;

	// ensure structure
	active.observe = lib.hash.to(active.observe);

	// merge user.observe over defaults
	const userObserve = lib.hash.to(lib.hash.get(user, "observe"));
	active.observe = lib.hash.merge(active.observe, userObserve, CONSTANTS.MERGE_OPTS_V1);

	const obs = active.observe;

	// normalize lists (grease: accept string/array)
	obs.selector = lib.array
            .to(obs.selector, CONSTANTS.ARR_TO_OPTS)
            .filter(v => typeof v === "string" && v.trim());

	obs.attribute_filter = lib.array
            .to(obs.attribute_filter, CONSTANTS.ARR_TO_OPTS)
            .filter(v => typeof v === "string" && v.trim());

	// NOTE:
	// We do NOT alias `boot.selector` into `observe.selector` here.
	// Fallback resolution (observe.selector || boot.selector) is handled at runtime
	// by the ObserveController, keeping discovery and observation decoupled.

	// attribute filter fallback (final safety net)
	if (!lib.array.len(obs.attribute_filter)) {
            obs.attribute_filter = lib.array
		.to(LAST_LINE.DEFAULT_ATTRIBUTE_SELECTOR, CONSTANTS.ARR_TO_OPTS)
		.filter(v => typeof v === "string" && v.trim());
	}

	// debounceMs
	obs.debounceMs = lib.number.toInt(obs.debounceMs, 25);
	if (obs.debounceMs < 0) obs.debounceMs = 25;

	// observeAttributes
	obs.observeAttributes = lib.bool.yes(obs.observeAttributes);

    }
    


    /**
     * Compile and normalize the `engine` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.engine` in-place.
     * - Produces a fully compiled engine configuration suitable for runtime use.
     *
     * LAYERING (precedence low → high):
     *   1) System/default engine config (`active.engine`)
     *   2) User-provided engine config (`user.engine`)
     * - User config overrides system config using `CONSTANTS.MERGE_OPTS_V1`.
     *
     * BUILTINS HANDLING (`engine.builtins`):
     * - Resolved via `_boolishCoerceHash(...)`.
     * - Boolish semantics:
     *     - Explicit opt-out on user layer (`false` / null) => `{}` (disable all builtins)
     *     - `true` on either layer => substitute default builtins map
     *     - object => merged with defaults (user wins on conflicts)
     * - Final surface:
     *     - Filtered to function values only
     *     - Deep filtering enabled
     *     - Empty containers compacted
     *
     * HOOKS HANDLING (`engine.hooks`):
     * - Resolved via `_boolishCoerceHash(...)`.
     * - Boolish semantics:
     *     - Explicit opt-out on user layer => `{}` (disable all hooks)
     *     - `true` => substitute built-in `testHooks`
     *     - object => merged with defaults (user wins on conflicts)
     * - Final surface:
     *     - Filtered to function values only
     *     - Shallow filtering (not deep)
     *
     * RESPONSIBILITIES:
     * - Normalize system and user engine config blocks.
     * - Resolve and compile the `engine.builtins` function surface.
     * - Resolve and compile the `engine.hooks` function surface.
     * - Merge engine configuration deterministically.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute builtins or hooks.
     * - Does NOT validate hook names or builtin behavior.
     * - Does NOT manage engine lifecycle or runtime state.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.engine` will:
     * - Be a plain object.
     * - Contain:
     *     - `builtins`: a (possibly nested) hash of functions only.
     *     - `hooks`: a hash of functions only.
     * - Be safe for runtime invocation without additional type checks.
     *
     * @param {Object} active
     *   The in-progress compiled configuration object.
     *
     * @param {Object} user
     *   Normalized user configuration object.
     */
    _configEngine(active, user) {
	const { lib } = this;

	// normalize blocks
	const sysEngine  = lib.hash.to(active.engine);
	const userEngine = lib.hash.to(lib.hash.get(user, "engine"));

	// builtins: boolish enable/disable/merge into fn-map
	const mBuiltins = this._boolishCoerceHash(
            sysEngine.builtins,
            userEngine.builtins,
            builtins,
            { deep: true, compact: true }
	);
	//engine hooks are not deep
	const mHooks = this._boolishCoerceHash(
            sysEngine.hooks,
            userEngine.hooks,
            testHooks
	);

	// merge engine block (user overrides defaults)
	const merged = lib.hash.merge(sysEngine, userEngine, CONSTANTS.MERGE_OPTS_V1);
	
	// force compiled builtins result (post-merge)
	merged.builtins = mBuiltins;
	merged.hooks    = mHooks;
	active.engine   = merged;
    }
    
    
    /**
     * Coerce a boolish config surface into a merged "hash of functions".
     *
     * This helper is used to compile surfaces like `engine.builtins` and `engine.hooks`
     * into a safe runtime callable map (functions only).
     *
     * SEMANTICS (boolish):
     * - `layer` is authoritative for disabling:
     *     - If `layer` is explicit opt-out (`lib.bool.no(layer)` OR `layer === null`),
     *       return `{}` and ignore `base` entirely.
     * - `base` and `layer` may be:
     *     - `true`  => treated as "enable defaults": substituted with `override`
     *     - object  => treated as user-provided map to merge
     *     - other   => coerced to `{}` via `lib.hash.to(...)`
     *
     * MERGE:
     * - After boolish substitution/coercion:
     *     merged = merge( hash(base), hash(layer), MERGE_OPTS_V1 )
     * - `layer` wins over `base` on conflicts (per MERGE_OPTS_V1).
     *
     * FILTERING:
     * - The merged object is filtered to function values only:
     *     `lib.hash.filter(merged, v => typeof v === "function", filterOpts)`
     * - If `filterOpts` enables deep/compact behavior, nested maps may be preserved
     *   and empty containers may be removed (per `lib.hash.filter` semantics).
     *
     * NOTES:
     * - Only `layer` is checked for explicit opt-out. A falsy/disabled `base` does
     *   not force-disable the result; it simply contributes no entries unless it is
     *   `true` (which enables `override`).
     *
     * @param {*} base
     *   System/default surface (may be boolish or object).
     *
     * @param {*} layer
     *   User/config surface (may be boolish or object). Explicit opt-out on this
     *   parameter disables the entire surface.
     *
     * @param {Object} override
     *   The default function map to substitute when either `base` or `layer` is `true`.
     *
     * @param {Object|boolean} [filterOpts]
     *   Options passed through to `lib.hash.filter(...)` (e.g. `{ deep:true, compact:true }`).
     *
     * @returns {Object}
     *   A (possibly nested) object containing only function values, safe for runtime invocation.
     */
    _boolishCoerceHash(base, layer, override, filterOpts) {
	const { lib } = this;

	// explicit opt-out on the layer disables everything (even if base enabled)
	if (lib.bool.no(layer) || layer === null) return {};

	// normalize boolish enable to override object
	if (lib.bool.yes(base))  base  = override;
	if (lib.bool.yes(layer)) layer = override;

	const hBase  = lib.hash.to(base);
	const hLayer = lib.hash.to(layer);

	const merged = lib.hash.merge(hBase, hLayer, CONSTANTS.MERGE_OPTS_V1);

	// functions-only surface (deep/compact controlled by filterOpts)
	return lib.hash.filter(merged, (v) => typeof v === "function", filterOpts);
    }
}


# --- end: at_config/Schema.js ---



# --- begin: auto.js ---

import ActiveTags from './ActiveTags.js';

const MOD = '[activeTags]';

const lib = (typeof window !== 'undefined' && window.lib) ? window.lib : null;
if (!lib) throw new Error(`${MOD} requires window.lib (browser environment).`);

if (typeof lib?.hash?.set !== 'function') {
  throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

// Normalize lib.site.delagator typo for older libs
if (!lib.site?.delegator && lib.site?.delagator) {
  lib.site.delegator = lib.site.delagator;
}

// Register
lib.hash.set(lib, 'site.activeTags', ActiveTags);

export { ActiveTags };
export default ActiveTags;


# --- end: auto.js ---



# --- begin: builtins/buffer/index.js ---

// builtins/buffer.js
// Builtins: buffer.set, buffer.get, buffer.traverse, buffer.clear
// VM signature: ({ job, lib, args, trigger, ticket, inputs, buffer, ctx, step }) => StageResultLike

import helpers from "../../class/engine/helpers.js";

/**
 * Normalize args into a plain object.
 * - If args is scalar => { value: args }
 * - If args is array  => { value: args[0] }
 * - If args is object => args
 */
function normalizeArgs(lib, args) {
    if (lib?.utils?.isScalar?.(args)) return { value: args };
    if (lib?.array?.is?.(args)) return { value: args[0] };
    if (args && typeof args === "object") return args;
    return {};
}

/**
 * Convert a path into tokens.
 * Supports:
 *  - "a.b.c"
 *  - "a[0].b"
 *  - ["a", 0, "b"]
 */
function tokenizePath(lib, path) {
    if (Array.isArray(path)) return path;
    if (!path || typeof path !== "string") return [];

    // Convert bracket notation: a[0].b -> a.0.b
    const s = path.replace(/\[(\d+)\]/g, ".$1");
    return s.split(".").filter(Boolean).map(tok => {
	// numeric tokens become numbers
	return (/^\d+$/).test(tok) ? Number(tok) : tok;
    });
}

function getBufferOrError(buffer, step) {
    if (!buffer || typeof buffer.get !== "function" || typeof buffer.set !== "function") {
	return helpers.SR_error(
	    new Error("buffer.* builtin: missing buffer slot (expected buffer.get/set/clear)"),
	    { op: "buffer", step }
	);
    }
    return null;
}

// -----------------------------------------------------------------------------
// buffer.set
// -----------------------------------------------------------------------------
export async function bufferSet({ lib, args, inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const opts = normalizeArgs(lib, args);
	const value = ("value" in opts) ? opts.value : null;
	const meta = opts.meta && typeof opts.meta === "object" ? opts.meta : null;

	buffer.set(value, meta);

	// convenience mirror (optional): expose latest value
	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.set", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.set", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.get
// -----------------------------------------------------------------------------
export async function bufferGet({ inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const value = buffer.get();

	// convenience: mirror into inputs.buffer (so other ops can read it easily)
	if (inputs && typeof inputs === "object") inputs.buffer = value;

	return helpers.SR_ok({ op: "buffer.get", step, value });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.get", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.clear
// -----------------------------------------------------------------------------
export async function bufferClear({ inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	if (typeof buffer.clear === "function") buffer.clear();
	else buffer.set(null);

	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.clear", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.clear", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.traverse
// Moves buffer.value => buffer.value[path]
// args:
//   { path: "a.b[0].c", required: true|false }
// -----------------------------------------------------------------------------
export async function bufferTraverse({ lib, args, inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const opts = normalizeArgs(lib, args);
	const path = opts.path ?? opts.value ?? null;
	const required = ("required" in opts) ? !!opts.required : true;

	const tokens = tokenizePath(lib, path);
	if (!tokens.length) {
	    return helpers.SR_error(new Error("buffer.traverse: missing/invalid path"), {
		op: "buffer.traverse",
		step,
		path
	    });
	}

	const root = buffer.get();

	// Prefer lib.hash.get if available (handles deep paths consistently)
	let out;
	if (lib?.hash?.get) {
	    // lib.hash.get usually expects "a.b.c" form; rebuild for it.
	    const dotPath = tokens.map(String).join(".");
	    out = lib.hash.get(root, dotPath);
	} else {
	    // Manual traversal
	    out = root;
	    for (const k of tokens) {
		if (out == null) break;
		out = out[k];
	    }
	}

	if (required && out === undefined) {
	    return helpers.SR_error(new Error("buffer.traverse: path not found"), {
		op: "buffer.traverse",
		step,
		path,
		tokens
	    });
	}

	buffer.set(out, { traverse: { path, tokens } });

	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.traverse", step, path, tokens });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.traverse", step });
    }
}

// -----------------------------------------------------------------------------
// Export bundle
// -----------------------------------------------------------------------------
export const BUFFER = {
    set: bufferSet,
    get: bufferGet,
    clear: bufferClear,
    traverse: bufferTraverse,
};

export default BUFFER;


# --- end: builtins/buffer/index.js ---



# --- begin: builtins/confirm.js ---

// builtins/confirm.js

export default async function confirmOp({ job, lib, args, inputs, step } = {}) {
  try {
    // node/headless environments: no confirm, so treat as pass (or error if you prefer)
    const win = lib?.hash?.get ? lib.hash.get(lib, "_env.root.window") : (typeof window !== "undefined" ? window : null);
    if (!win || typeof win.confirm !== "function") {
      return { status: "ok", detail: { op: "confirm", step, skipped: true, reason: "noWindowConfirm" } };
    }

    const e = job?.e;
    const fromDom = (e && lib?.dom?.filterAttributes)
      ? (lib.dom.filterAttributes(e, /^data-confirm-/, 1) || {})
      : {};

    // also allow plain data-confirm="Are you sure?"
    // (filterAttributes(/^data-confirm$/) doesn’t work well, so just read it directly)
    const directMsg = e?.getAttribute?.("data-confirm");

    const opts = (args && typeof args === "object") ? args : {};

    // message precedence: args.message > data-confirm > data-confirm-text > fallback
    const message =
      opts.message ||
      directMsg ||
      fromDom.text ||
      fromDom.message ||
      "Are you sure?";

    // enabled policy: if attribute exists or args.enabled true
    const enabled =
      ("enabled" in opts) ? !!opts.enabled :
      (directMsg != null) ? true :
      (Object.keys(fromDom).length > 0);

    if (!enabled) {
      return { status: "ok", detail: { op: "confirm", step, enabled: false } };
    }

    const ok = win.confirm(String(message));
    if (ok) {
      return { status: "ok", detail: { op: "confirm", step, confirmed: true } };
    }

    // cancel behavior: stop cleanly (no error pipeline)
    inputs.cancelled = true;
    return { status: "complete", detail: { op: "confirm", step, confirmed: false, cancelled: true } };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "confirm", step } };
  }
}


# --- end: builtins/confirm.js ---



# --- begin: builtins/dom/domPatch.js ---

// builtins/domPatch.js
import helpers from '../../class/engine/helpers.js';

/**
 * dom.patch (v1, target-driven)
 *
 * Target:
 *  - `ticket.target` MUST be a DOM element (hard fail if not)
 *  - Target selection and navigation are handled explicitly via `target.*` builtins
 *
 * Sources:
 *  - `data-attr-*` attributes on the target element (prefix stripped)
 *  - op args (explicit patch object)
 *
 * Merge precedence:
 *  - op args override DOM attributes
 *
 * Effect:
 *  - For each key/value pair in the merged patch object:
 *      lib.dom.set(target, key, value)
 *
 * Notes:
 *  - This builtin does not read from or write to the buffer.
 *  - It operates strictly on the current working target.
 *  - Payload/data pipelines are expected to resolve targets explicitly
 *    before invoking dom.patch.
 */
export default async function domPatch({ job, lib, args, ticket, target, step } = {}) {
    try {
        // 1) target must be DOM (hard fail)
        const el = target || ticket.target;
        lib.dom.attempt(el, true);

        // 2) patch from DOM attributes on target
        const fromDom = lib.dom.filterAttributes(el, /^data-attr-/, 1) || {};

        // 3) patch from args (args wins)
        const fromArgs = lib.array.is(args)
            ? lib.hash.to(args[0])
            : lib.hash.to(args);

        const patch = { ...fromDom, ...fromArgs };

        // 4) apply
        let applied = 0;
        for (const k in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
            lib.dom.set(el, k, patch[k]);
            applied++;
        }

        return helpers.SR_ok({
            op: "dom.patch",
            applied,
            keys: lib.hash.keys(patch),
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "dom.patch", step });
    }
}


# --- end: builtins/dom/domPatch.js ---



# --- begin: builtins/dom/index.js ---

// builtins/dom/index.js
import patch from './domPatch.js';

const DOM = {
    PATCH: "patch",
    // grow here: HTML, TEXT, ATTR, CLASS_ADD, CLASS_REMOVE, REMOVE, APPEND, etc.
};

export { DOM };

// Named exports (ergonomic for direct import)
export const domPatch = patch;

// Default export: iterable builtin tree for barrel registration
export default {
    [DOM.PATCH]: patch,
};


# --- end: builtins/dom/index.js ---



# --- begin: builtins/error/errorDump.js ---

export default async function errorDump({ job, lib, args, trigger, ticket, inputs, ctx, step } = {}) {
  try {
    const opts = (args && typeof args === "object") ? args : {};

    const original = ticket?.errorInfo || null;
    const err =
      original?.error ||
      ticket?.last?.res?.error ||
      null;

    const payload = {
      at: Date.now(),
      op: "error.dump",
      phase: ticket?.phase || null,
      pipelineKey: ticket?.pipelineKey || null,
      step: step || null,
      jobId: job?.id || null,
      jobName: job?.name || null,
      trigger: trigger || null,
      original,
      error: err ? { name: err.name, message: err.message, stack: err.stack } : null,
      inputs: (opts.includeInputs === false) ? null : inputs,
      ctx: opts.includeCtx ? ctx : null,
    };

    // store for later inspection
    if (inputs && typeof inputs === "object") {
      if (!Array.isArray(inputs.errors)) inputs.errors = [];
      inputs.errors.push(payload);
    }

    // console output (keeps stack visible)
    if (opts.console !== false) {
      const log = (opts.level === "warn") ? console.warn : console.error;
      log("[AT][error.dump]", payload);
      if (opts.printStack !== false && err) log(err); // ensures browser prints stack as an Error
    }

    // optional breakpoint for “traceable”
    if (opts.debugger === true) debugger;

    // OPTIONAL: throw to stop execution + get a real stack trace
    if (opts.throw === true) {
      // Prefer rethrowing original if present (best stack)
      if (err instanceof Error) {
        err.atPayload = payload; // attach payload for inspection
        throw err;
      }

      // Otherwise throw a new error with cause
      const e = new Error("AT error.dump: throwing for trace", { cause: err || undefined });
      e.atPayload = payload;
      throw e;
    }

    return { status: "ok", detail: { op: "error.dump", dumped: true, step } };
  } catch (err2) {
    return { status: "error", error: err2, detail: { op: "error.dump", step } };
  }
}


# --- end: builtins/error/errorDump.js ---



# --- begin: builtins/error/index.js ---

import  errorDump  from './errorDump.js';

export  { errorDump };

export  function errorFail(){
    return false;
}
export const ERROR = {
    dump : errorDump,
    fail :  errorFail
};

export default ERROR;


# --- end: builtins/error/index.js ---



# --- begin: builtins/form/formCollect.js ---

//builtins/form/formCollect.js
/**
 * Collect form data from the effective form source and stage it onto the buffer.
 *
 * This builtin invokes `lib.site.form.collect` using the engine trigger (or job
 * element fallback) and replaces the current buffer value with the collected
 * form context.
 *
 * Source resolution order:
 *  1) `trigger` — engine-provided trigger element
 *  2) `job.e`   — the job’s bound element (usually the <form>)
 *
 * The resolved source is asserted to be a valid DOM element. The collection
 * result is expected to include a `form` context; failure to do so is treated
 * as a system error.
 *
 * This stage performs no network activity and does not mutate `inputs`.
 * It exists solely to move form state onto the buffer for downstream stages
 * such as `form.submit` / `http.send`.
 *
 * Failure semantics:
 * - Throws if no valid DOM element can be resolved.
 * - Throws if `lib.site.form.collect` returns an invalid result.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.job        The current job (guaranteed by engine)
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Object|null} params.args  Optional options forwarded to form.collect
 * @param {Object} params.buffer     Ticket buffer (conveyor slot)
 * @param {Element|null} params.trigger
 *                                  Engine-provided trigger element
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after placing collected form data onto the buffer,
 *   or `{ status: "error" }` if form resolution or collection fails.
 */

export default async function formCollect({ job, lib, args, step, trigger, buffer } = {}) {
    try {
        const collect = lib.site.form.collect;

        const source = trigger || job.e;
        lib.dom.attempt(source, true);

        const opts = lib.hash.is(args) ? args : {};
        const data = collect(source, opts);

        if (!data || !data.form) {
            throw new Error("form.collect: collect() returned invalid form context");
        }

        // conveyor: buffer now carries collected form context
        buffer.set(data);

        return {
            status: "ok",
            detail: {
                op: "form.collect",
                step,
                count: lib.array.len(data.parms),
            },
        };
    } catch (err) {
        return {
            status: "error",
            error: err,
            detail: { op: "form.collect", step },
        };
    }
}


# --- end: builtins/form/formCollect.js ---



# --- begin: builtins/form/formPrepare.js ---

/**
 * Prepare submit context for a form-driven pipeline.
 *
 * This builtin resolves the effective DOM element that should act as the
 * submit source and stages it for downstream form operations.
 *
 * In most cases this stage is **not required**:
 * - A typical form pipeline triggered by a submit button will already
 *   have a valid engine-provided `trigger`.
 * - `form.collect` and `form.submit` can usually operate without any
 *   explicit preparation.
 *
 * This stage exists primarily as:
 * - An explicit override point when a different submit source is desired
 *   (e.g. custom triggers, delegated events, synthetic submissions).
 * - A reserved staging hook for future extensions (confirmation,
 *   preprocessing, linting, or trigger normalization).
 *
 * Resolution order:
 *  1) `inputs.trigger` — explicit user override (if present)
 *  2) `trigger`        — engine-provided trigger element
 *  3) `job.e`          — the job’s bound element (typically the `<form>`)
 *
 * The resolved element is asserted to be a valid DOM element and written
 * to the ticket buffer. This prepares the pipeline for `form.collect`,
 * which expects a form element or one of its descendants.
 *
 * This stage performs **no submission, collection, or network activity**.
 * It exists purely to normalize and stage submit context.
 *
 * Failure semantics:
 * - Throws if no valid DOM element can be resolved.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.job        The current job (guaranteed by engine)
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Element|null} params.trigger
 *                                  Engine-provided trigger element
 * @param {Object|null} params.inputs
 *                                  User-provided inputs (may be null/undefined)
 * @param {Object} params.buffer     Ticket buffer (submit context staging)
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after staging the submitter,
 *   or `{ status: "error" }` if resolution or assertion fails.
 */

export default async function formPrepare({ job, lib, trigger, inputs, ticket, step } = {}) {
    try {
        // optional user override (may be null / non-dom)
        const override = lib.dom.attempt(inputs?.trigger);

        const submitter =
            override ||
            trigger ||
            job.e;

        lib.dom.attempt(submitter, true);

        // canonicalize trigger for the rest of the ticket lifetime
        ticket.trigger = submitter;

        return { status: "ok", detail: { op: "form.prepare", step } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "form.prepare", step } };
    }
}


# --- end: builtins/form/formPrepare.js ---



# --- begin: builtins/form/formSubmit.js ---

// builtins/form/formSubmit.js
/**
 * @file formSubmit.js
 *
 * ActiveTags builtin: `form.submit`
 *
 * Pipeline-aware wrapper around `lib.site.form.submit` that integrates
 * form submission into the ActiveTags execution model.
 *
 * Responsibilities
 * ----------------
 * - Resolves request options via pipeline metadata (`buffer.meta()`) and runtime args.
 * - Normalizes the submission source (DOM element or prior form.collect output).
 * - Delegates collection, encoding, transport, and response parsing to `lib.site.form.submit`.
 * - Records the request/response pair as a transaction on the job.
 * - Advances the pipeline conveyor by writing the response into the buffer.
 *
 * Design notes
 * ------------
 * - This builtin prefers an existing `form.collect` output if present in the buffer;
 *   otherwise it resolves the submission source from the engine trigger or job element.
 * - The buffer is not implicitly mutated on input; it is only written on successful submission.
 * - Request metadata (headers, mode, etc.) is resolved centrally via `makeOpts`,
 *   with pipeline-staged metadata taking precedence over per-op arguments.
 * - The builtin does not mutate `inputs`; the buffer is the sole data conveyor.
 * - Transaction storage is observational only and does not affect pipeline control flow.
 *
 * Expected buffer states
 * ----------------------
 * - Input: form.collect output (optional)
 * - Output: submission response payload
 *
 * Related helpers
 * ---------------
 * - makeOpts: resolves final request options from buffer meta and args
 * - normalizeTarget: resolves and validates the submission source
 * - storeTransaction: records request/response metadata on the job
 */

export default async function formSubmit({ job, lib, args, trigger, buffer, step } = {}) {
    try {
        const submit = lib.site.form.submit;

        // request metadata (headers etc.)
        const opts = makeOpts({ lib, buffer, args });

        // resolve submission source (DOM element or collect object)
        const { src } = normalizeTarget({ lib, buffer, trigger, job });

        // send (submit handles collect+encode+request+parse per opts)
        const payload = await submit(src, opts);

        // ---- OUTPUT WIRING ----
        const reqName = opts.name || opts.requestName || "default";

        storeTransaction({
            lib,
            job,
            name: reqName,
            request: src,
            response: payload,
            type: "HTTP/1",
            meta: { op: "form.submit" },
        });

        // conveyor: buffer now carries response
        buffer.set(payload);

        return {
            status: "ok",
            detail: {
                op: "form.submit",
                step,
                ok: !!payload?.ok,
                status: payload?.status ?? null,
            },
        };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "form.submit", step } };
    }
}

function makeOpts({ lib, buffer, args } = {}) {
    const staged = buffer.meta() || {};
    const runtime = lib.hash.is(args) ? args : {};

    const rHeaders = lib.hash.is(runtime.headers) ? runtime.headers : {};
    const sHeaders = lib.hash.is(staged.headers) ? staged.headers : null;

    // headers: staged wins over runtime
    const headers = sHeaders
        ? Object.assign({}, rHeaders, sHeaders)
        : (lib.hash.is(runtime.headers) ? runtime.headers : undefined);

    return {
        ajax: true, // ActiveTags default policy
        ...runtime,
        ...staged,
        headers,
    };
}

/**
 * Resolve and validate the submission source.
 *
 * Resolution order:
 * 1) Buffered `form.collect` output (if present)
 * 2) Current trigger element
 * 3) Job root element (`job.e`)
 *
 * @param {Object} deps
 * @param {Object} deps.lib
 * @param {Object} deps.buffer
 * @param {*} deps.trigger
 * @param {Object} deps.job
 * @returns {{src: *, dom: *}}
 */
function normalizeTarget({ lib, buffer, trigger, job } = {}) {
    const isCollect = (x) => x && x.form && Array.isArray(x.parms);

    const buf = buffer.get();
    const src = isCollect(buf)
        ? buf
        : (trigger || job.e);

    const dom = isCollect(src) ? (src.event || src.form) : src;
    lib.dom.attempt(dom, true);

    return { src, dom };
}

/**
 * Persist a lightweight request/response transaction record on the job.
 *
 * @param {Object} deps
 * @param {Object} deps.job
 * @param {string} [deps.name]
 * @param {*} [deps.request]
 * @param {*} [deps.response]
 * @param {*} [deps.meta]
 * @param {string} [deps.type]
 * @returns {Object} Stored transaction record.
 */
function storeTransaction({ lib, job, name, request, response, meta, type } = {}) {
    const txName = name || "default";

    if (!job.transactions) job.transactions = {};

    const tx = {
        ts: Date.now(),
        request: request ?? null,
        response: response ?? null,
        type: type || "HTTP/1",
        meta: meta || null,
    };

    job.transactions[txName] = tx;

    return tx;
}


# --- end: builtins/form/formSubmit.js ---



# --- begin: builtins/form/index.js ---

import  formCollect      from './formCollect.js';
import  formPrepare      from './formPrepare.js';
import  formSubmit       from './formSubmit.js';
import  requestHeaders   from './requestHeaders.js';

export { formCollect };
export { formPrepare };
export { formSubmit };
export { requestHeaders };

export const FORM = {
    collect: formCollect,
    prepare: formPrepare,
    submit: formSubmit,
    headers: requestHeaders
};

export default FORM;


# --- end: builtins/form/index.js ---



# --- begin: builtins/form/requestHeaders.js ---

// builtins/requestHeaders.js
// Op name: "request.headers"
/**
 * Attach HTTP request headers to the current buffer context.
 *
 * This builtin annotates the ticket buffer with request-scoped headers
 * to be consumed later by transport stages (e.g. `form.submit`, `http.send`).
 *
 * Headers are stored on `buffer.meta().headers` and do not affect the
 * buffer value itself. This keeps payload data and transport metadata
 * cleanly separated.
 *
 * Supported argument shapes:
 * - `{ "X-CSRF": "abc", "Authorization": "Bearer token" }`
 * - `{ headers: { ... } }`
 * - `{ mode: "merge" | "replace" | "clear", headers: { ... } }`
 *
 * Modes:
 * - `"merge"`   (default): shallow-merge headers into existing set
 * - `"replace"`: replace all existing headers
 * - `"clear"`  : remove all headers
 *
 * This stage performs no network activity and does not validate header
 * values. It exists purely to stage request metadata for downstream
 * transport operations.
 *
 * Failure semantics:
 * - Throws on invalid arguments or buffer access errors.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Object|null} params.args  Header definitions and options
 * @param {Object} params.buffer     Ticket buffer (conveyor slot)
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after headers are staged on the buffer,
 *   or `{ status: "error" }` if header mutation fails.
 */

export default async function requestHeaders({ lib, args, buffer, step } = {}) {
    try {
        const a = lib.hash.is(args) ? args : {};
    // args is user-supplied; normalize lightly using your tools
    // Supported shapes:
    //  - { "X-CSRF": "abc" }
    //  - { headers: { ... } }
    //  - { mode: "replace"|"merge"|"clear", headers: { ... } }

        const mode = a.mode || "merge";
        const h = lib.hash.is(a.headers) ? a.headers : a;

        const meta = buffer.meta();
        meta.headers = lib.hash.is(meta.headers) ? meta.headers : {};

        if (mode === "clear") {
            meta.headers = {};
        } else if (mode === "replace") {
            meta.headers = h;           // no coercion
        } else {
            Object.assign(meta.headers, h);
        }

        return { status: "ok", detail: { op: "request.headers", step, mode } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "request.headers", step } };
    }
}


# --- end: builtins/form/requestHeaders.js ---



# --- begin: builtins/httpSend.js ---

// builtins/httpSend.js
export default async function httpSend({ job, lib, args, trigger, inputs, step } = {}) {
  try {
    const submit = lib.site.form.submit;

    // Prefer trigger (submitter / event target), fallback to job element
    const source = trigger || job.e;
    lib.dom.attempt(source, true);

    // runtime overrides
    const opts = lib.hash.is(args) ? { ...args } : {};
    opts.ajax = true;

    // send (submit handles collect+encode+request+parse per opts)
    const payload = await submit(source, opts);

    // downstream consumption
    inputs.response = payload;

    // optional request record
    const reqName = opts.name || opts.requestName || "default";
    if (!job.requests) job.requests = {};
    job.requests[reqName] = {
      ts: Date.now(),
      input: inputs.request || null,
      output: payload,
      meta: { op: "http.send" },
    };

    return {
      status: "ok",
      detail: {
        op: "http.send",
        step,
        ok: !!payload?.ok,
        status: payload?.status ?? null,
      },
    };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "http.send", step } };
  }
}


# --- end: builtins/httpSend.js ---



# --- begin: builtins/index.js ---

import  dom          from './dom/index.js';
import  form         from './form/index.js';
import  httpSend     from './httpSend.js';
import  confirm      from './confirm.js';
import  error        from './error/index.js';
import  buffer       from './buffer/index.js';
import  target       from './target/index.js';

export { dom };
export { form};
export { httpSend };
export { buffer };
export { target };
export { error } ;

export default {
    confirm,
    dom,
    form ,
    http: {
	send: httpSend
    },
    error,
    buffer,
    target
};




# --- end: builtins/index.js ---



# --- begin: builtins/target/index.js ---

// builtins/target/index.js

const TARGET = {
    RESET:   "reset",
    SET:     "set",
    FROMBUF: "fromBuffer",
    TOBUF:   "toBuffer",
    CLOSEST: "closest",
    FIND:    "find",
    PARENT:  "parent",
    CHILD:   "child",
};

/**
 * Normalize: current target must be a DOM element.
 */
function _cur({ lib, ticket }) {
    const cur = ticket.target;
    lib.dom.attempt(cur, true);
    return cur;
}

/**
 * target.reset
 * Sets ticket.target back to job.e.
 */
export async function targetReset({ job, lib, ticket } = {}) {
    try {
        ticket.target = job.e;
        lib.dom.attempt(ticket.target, true);
        return { status: "ok", detail: { op: TARGET.RESET } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.RESET } };
    }
}

/**
 * target.set
 * Sets ticket.target from:
 *  - args.selector (string) resolved from document
 *  - args.el (DOM element)
 *  - args (string selector) shorthand
 */
export async function targetSet({ lib, args, ticket } = {}) {
    try {
        const doc = lib.hash.get(lib, "_env.root.document") || document;

        let next = null;
        if (typeof args === "string") {
            next = doc.querySelector(args);
        } else if (args && typeof args === "object") {
            if (args.el) next = args.el;
            else if (args.selector) next = doc.querySelector(args.selector);
        }

        lib.dom.attempt(next, true);
        ticket.target = next;

        return { status: "ok", detail: { op: TARGET.SET } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.SET } };
    }
}

/**
 * target.fromBuffer
 * Sets ticket.target from buffer.get() (must be DOM).
 */
export async function targetFromBuffer({ lib, ticket, buffer } = {}) {
    try {
        const next = buffer.get();
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.FROMBUF } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.FROMBUF } };
    }
}

/**
 * target.toBuffer
 * Writes current ticket.target into buffer.
 */
export async function targetToBuffer({ lib, ticket, buffer } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        buffer.set(cur);
        return { status: "ok", detail: { op: TARGET.TOBUF } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.TOBUF } };
    }
}

/**
 * target.closest
 * Moves target to closest(selector).
 * args: string selector OR { selector: string }
 */
export async function targetClosest({ lib, args, ticket } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        const selector = (typeof args === "string") ? args : args.selector;
        const next = cur.closest(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.CLOSEST, selector } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.CLOSEST } };
    }
}

/**
 * target.find
 * Moves target to querySelector(selector) within current target.
 * args: string selector OR { selector: string }
 */
export async function targetFind({ lib, args, ticket } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        const selector = (typeof args === "string") ? args : args.selector;
        const next = cur.querySelector(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.FIND, selector } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.FIND } };
    }
}

/**
 * target.parent
 * Moves target to parentElement (or closest selector if provided).
 * args: optional selector string or { selector }
 */
export async function targetParent({ lib, args, ticket } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        const selector = (typeof args === "string") ? args : args?.selector;

        const next = selector ? cur.closest(selector)?.parentElement : cur.parentElement;
        lib.dom.attempt(next, true);
        ticket.target = next;

        return { status: "ok", detail: { op: TARGET.PARENT, selector: selector || null } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.PARENT } };
    }
}

/**
 * target.child
 * Moves target to children[index] (default 0).
 * args: number index OR { index }
 */
export async function targetChild({ lib, args, ticket } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        const index = (typeof args === "number") ? args : (args?.index ?? 0);
        const next = cur.children[index];
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.CHILD, index } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.CHILD } };
    }
}

export default {
    [TARGET.RESET]:   targetReset,
    [TARGET.SET]:     targetSet,
    [TARGET.FROMBUF]: targetFromBuffer,
    [TARGET.TOBUF]:   targetToBuffer,
    [TARGET.CLOSEST]: targetClosest,
    [TARGET.FIND]:    targetFind,
    [TARGET.PARENT]:  targetParent,
    [TARGET.CHILD]:   targetChild,
};

export { TARGET };


# --- end: builtins/target/index.js ---



# --- begin: class/discover/Controller.js ---

// class/discover/Controller.js

import Job from '../job/Job.js';
import CONSTANTS from '../../constants.js';
import configReporter from '../../helpers/reporter/configReporter.js';

/**
 * Discover Controller
 * ===================
 *
 * Subsystem role
 * --------------
 * The Discover Controller is the DOM to JobRegistry bridge of ActiveTags.
 *
 * Responsibilities
 * ---------------
 * It scans the DOM for candidate elements, instantiates Job objects for eligible
 * elements, registers Jobs into the runtime JobRegistry, performs initial safe
 * job configuration, and emits configuration diagnostics.
 *
 * Non-responsibilities
 * --------------------
 * It does not execute jobs, schedule jobs, manage pipelines, run the engine,
 * manage intervals or events, or mutate the DOM.
 *
 * Architectural position
 * ----------------------
 * This controller operates strictly at the boundary:
 *
 * DOM -> Job instances -> JobRegistry
 *
 * It is deterministic, idempotent per DOM element, side-effect limited to
 * registration, and free of execution semantics. Execution is handled by the
 * Engine layer.
 *
 * Public surface
 * --------------
 * scan(sel?, opts?) -> Promise<Job[]>
 *   Perform DOM scan and job registration.
 *
 * registerJobs(list, opts?) -> Promise<Job[]>
 *   Instantiate and register jobs for a provided element list.
 *
 * sweep(sel?) -> Element[]
 *   Pure DOM discovery with no side effects.
 *
 * Lifecycle model
 * ---------------
 * This controller is not stateful in the runtime sense. It does not implement
 * on/off/start/stop semantics because it is not a signal source, it does not
 * bind listeners, and it does not maintain runtime attachments.
 *
 * It is an orchestration tool intended to run at boot, on demand, or from
 * MutationObserver callbacks.
 *
 * Idempotency guarantee
 * ---------------------
 * Job identity is bound to DOM elements.
 *
 * If an element is already associated with a Job, scan() will not create a
 * duplicate. registerJobs() will return existing Jobs unless
 * opts.ignoreExisting is true.
 *
 * Configuration flow
 * ------------------
 * For newly created Jobs:
 *
 * 1. Base job configuration is taken from AT.conf.job.config
 * 2. Runtime overrides (evalEnabled, importEnabled, etc.) may be supplied via opts
 * 3. Job.configure() is invoked exactly once at creation
 * 4. Configuration diagnostics are emitted via configReporter()
 *
 * Failure modes
 * -------------
 * This controller will throw if AT.conf.env.document is missing or invalid, or
 * if required dependencies (AT, lib, JobRegistry) are missing.
 *
 * It will silently skip non-DOM values, invalid selectors, duplicate elements,
 * and empty selector inputs.
 *
 * Design constraints
 * ------------------
 * It must remain execution-agnostic, must not leak engine semantics, must not
 * mutate runtime job state beyond registration, and must remain safe to call
 * repeatedly.
 *
 * Future extensions
 * -----------------
 * Possible additions that fit this subsystem include reconcile() for full DOM
 * reconciliation, explicit detachment helpers, and subtree scan helpers. Any
 * feature involving execution or scheduling does not belong here.
 */

export class Controller {

    /**
     * Create a new Discover Controller.
     *
     * CONTRACT
     * --------
     * The Discover Controller requires a fully initialized ActiveTags instance.
     * It must be constructed only after the following are available on AT:
     *   AT.jobs (JobRegistry)
     *   AT.conf (compiled configuration)
     *   AT.expr (ExpressionResolver)
     *
     * Construction performs validation and reference caching only.
     * No DOM scanning, job creation, or execution logic occurs here.
     *
     *
     * REQUIRED DEPENDENCIES
     * ---------------------
     * @param {Object} opts
     *
     * @param {ActiveTags} opts.AT
     *   The owning ActiveTags instance.
     *   Must expose:
     *     jobs   JobRegistry
     *     conf   compiled configuration
     *     expr   ExpressionResolver
     *     svc    service map
     *
     * @param {Object} opts.lib
     *   The m7 lib instance.
     *   Used for DOM inspection, normalization, and configuration merging.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Caches stable references to AT, lib, jobs, expr, conf, and svc.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     * Throws if AT.jobs is not present.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform DOM scans.
     * Does not create or configure Jobs.
     * Does not execute or schedule pipelines.
     *
     * Those responsibilities are handled by scan(), registerJobs(), and sweep().
     */
    constructor({ AT, lib, toJob } = {}) {
        if (!AT) throw new Error("discover/Controller requires AT");
        if (!lib) throw new Error("discover/Controller requires lib");
        if (typeof toJob !== "function")
            throw new Error("discover/Controller requires toJob(x) function");

        if (!AT.jobs)
            throw new Error("discover/Controller requires AT.jobs (JobRegistry)");

        this.AT     = AT;
        this.lib    = lib;
        this.toJob  = toJob;

        this.jobs   = AT.jobs;
        this.expr   = AT.expr;
        this.conf   = AT.conf;
        this.svc    = AT.svc;

        Object.freeze(this);
    }

    /**
     * Scan the DOM and register Jobs for discovered elements.
     *
     * CONTRACT
     * --------
     * scan() is the primary public entry point of the Discover Controller.
     * It performs DOM candidate discovery followed by Job instantiation
     * and registration.
     *
     * It does not execute Jobs.
     * It does not schedule pipelines.
     * It does not mutate the DOM.
     *
     * This method is safe to call repeatedly.
     *
     *
     * INPUT
     * -----
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *   Selector string, DOM element, or array of selectors and or elements.
     *   If null or undefined, defaults to AT.conf.boot.selector.
     *
     * @param {Object} [opts={}]
     *   Optional registration behavior overrides.
     *   Supported keys include:
     *     ignoreExisting
     *     evalEnabled
     *     evalType
     *     importEnabled
     *     importPath
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls sweep(sel) to obtain a de-duplicated list of candidate elements.
     * 2. If no candidates are found, returns an empty array.
     * 3. Calls registerJobs(list, opts) to instantiate and register Jobs.
     * 4. Returns the array of registered Job instances.
     *
     *
     * IDEMPOTENCY
     * -----------
     * If an element is already associated with a Job, no duplicate Job is created.
     * Existing Jobs are returned unless opts.ignoreExisting is true.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job[]>}
     *   Resolves to an array of Job instances that are now registered.
     *   May be empty if no candidates were found.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if sweep() fails due to missing or invalid configuration.
     * Propagates any errors thrown by registerJobs().
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create and register new Job instances.
     * May configure newly created Jobs.
     * May emit configuration diagnostics.
     */
    async scan(sel = null, opts = {}) {
        const list = this.sweep(sel);
        if (!this.lib.array.len(list)) return [];
        return this.registerJobs(list, opts);
    }

    /**
     * Instantiate and register Jobs for a list of DOM elements.
     *
     * CONTRACT
     * --------
     * registerJobs() converts DOM elements into persistent Job instances
     * and registers them into the JobRegistry.
     *
     * It does not execute Jobs.
     * It does not schedule pipelines.
     * It does not mutate the DOM.
     *
     * This method is safe to call repeatedly.
     *
     *
     * INPUT
     * -----
     * @param {Array<Element>|ArrayLike<Element>} list
     *   Collection of DOM elements to process.
     *   Non-DOM values are ignored.
     *
     * @param {Object} [opts={}]
     *   Optional registration overrides.
     *
     *   Supported keys include:
     *     ignoreExisting
     *     evalEnabled
     *     evalType
     *     importEnabled
     *     importPath
     *
     *
     * BEHAVIOR
     * --------
     * 1. Normalizes input list into an array.
     * 2. Skips values that are not valid DOM elements.
     * 3. For each element:
     *      If a Job already exists for the element:
     *          Returns the existing Job unless ignoreExisting is true.
     *      If no Job exists:
     *          Creates a new Job instance.
     *          Registers the Job with the JobRegistry.
     *          Merges base job configuration with runtime overrides.
     *          Invokes Job.configure() exactly once.
     *          Emits configuration diagnostics.
     *          Sets the Job name in the registry.
     *
     *
     * IDEMPOTENCY
     * -----------
     * Job identity is bound to DOM elements.
     * No duplicate Job will be created for the same element.
     *
     *
     * CONFIGURATION RULES
     * -------------------
     * Base configuration is taken from AT.conf.job.config.
     * Runtime overrides are limited to eval and import related keys.
     * Merge semantics follow CONSTANTS.MERGE_OPTS_V1.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job[]>}
     *   Resolves to an array of Job instances that are now registered.
     *   The array may include existing Jobs unless ignoreExisting is true.
     *
     *
     * FAILURE MODES
     * -------------
     * Propagates errors thrown by:
     *   Job constructor
     *   JobRegistry.register()
     *   Job.configure()
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create and register new Job instances.
     * May configure newly created Jobs.
     * May emit configuration diagnostics.
     * May update registry name mappings.
     */
    async registerJobs(list, opts = {}) {
        const { lib } = this;
        const jobs = [];

        opts = lib.hash.to(opts, 'ignoreExisting');
        list = lib.array.to(list);

        const ignoreExisting = lib.bool.yes(opts.ignoreExisting);

        for (let i = 0; i < list.length; i++) {
            const tag = list[i];
            if (!lib.dom.is(tag)) continue;

            const existing = this.jobs.getByElement(tag);
            if (existing) {
                if (!ignoreExisting) jobs.push(existing);
                continue;
            }

            const job = new Job({
                lib,
                expr: this.expr,
                e: tag,
                ws: {},
                conf: this.conf.job,
                env: this.conf.env
            });

            const registered = this.jobs.register(job);
            jobs.push(registered);

            // ---- configuration phase ----
            const def     = this.conf.job.config;
            const runOpts = lib.hash.slice(
                opts,
                "evalEnabled evalType importEnabled importPath"
            );

            const jobConf = lib.hash.merge(
                def,
                runOpts,
                CONSTANTS.MERGE_OPTS_V1
            );

            await registered.configure(jobConf);

            // ---- diagnostics ----
            configReporter({
                lib,
                job: registered,
                log: this.svc.log,
                bucketName:
                this.conf.log.buckets[CONSTANTS.LOG_BUCKETS.CONFIG]
            });

            this.jobs.setName(registered, registered.name);
        }

        return jobs;
    }


    /**
     * Discover candidate DOM elements for Job registration.
     *
     * CONTRACT
     * --------
     * sweep() performs pure DOM discovery.
     * It does not create Jobs.
     * It does not register Jobs.
     * It does not execute or schedule pipelines.
     * It does not mutate runtime state.
     *
     * This method is deterministic and side-effect free.
     *
     *
     * INPUT
     * -----
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *   Selector string, DOM element, or array of selectors and or elements.
     *   If null or undefined, defaults to AT.conf.boot.selector.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Validates that a usable document exists in AT.conf.env.
     * 2. Normalizes input into an array of targets.
     * 3. For each target:
     *      If it is a DOM element, it is added directly.
     *      Otherwise it is treated as a selector and queried via document.querySelectorAll.
     * 4. De-duplicates results using object identity.
     * 5. Returns the resulting array of DOM elements.
     *
     *
     * OUTPUT GUARANTEE
     * ----------------
     * @returns {Element[]}
     *   A de-duplicated array of DOM elements.
     *   May be empty if no matches are found.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT.conf.env is missing.
     * Throws if AT.conf.env.document is missing or does not support querySelectorAll.
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * sweep() must remain:
     *   Pure with respect to runtime state.
     *   Independent of JobRegistry.
     *   Independent of execution semantics.
     *   Safe to call repeatedly on the same input.
     */
    sweep(sel = null) {
        const { lib } = this;
        const env = this.conf.env;

        if (!env)
            throw new Error("discover/Controller.sweep(): missing conf.env");

        const { document } = env;
        if (!document || typeof document.querySelectorAll !== "function") {
            throw new Error(
                "discover/Controller.sweep(): invalid or missing document"
            );
        }

        const input = sel ?? this.conf.boot.selector;

        const targets = lib.dom.is(input)
              ? [input]
              : lib.array.to(input);

        const out = [];
        const seen = new Set();

        const push = (node) => {
            if (!node || !lib.dom.is(node) || seen.has(node)) return;
            seen.add(node);
            out.push(node);
        };

        for (const t of targets) {
            if (lib.dom.is(t)) {
                push(t);
                continue;
            }

            const selector = String(t ?? "").trim();
            if (!selector) continue;

            const nodes = document.querySelectorAll(selector);
            for (const n of nodes) push(n);
        }

        return out;
    }
}

export default Controller;


# --- end: class/discover/Controller.js ---



# --- begin: class/engine/Buffer.js ---

//engine/Buffer.js
/**
 * Buffer
 * ======
 *
 * Lightweight, mutable value container attached to each Engine ticket.
 *
 * Conceptual role in ActiveTags:
 * ------------------------------
 * ActiveTags pipelines operate like a conveyor belt.
 * Each ticket carries two core runtime primitives:
 *
 *   1) buffer — transient data store (this class)
 *   2) target — current DOM target (carried on the ticket)
 *
 * The buffer is the structured handoff mechanism between pipeline steps.
 * Each operation may:
 *   - read the current buffer value
 *   - transform it
 *   - write a new value (optionally attaching metadata)
 *
 * This enables deterministic, stepwise data flow without global mutation.
 *
 * Design goals:
 * -------------
 * - Extremely small surface area.
 * - No knowledge of jobs, engine, DOM, or pipelines.
 * - Mutable by design (tickets are single-threaded execution units).
 * - JSON-safe when serialized.
 *
 * Value semantics:
 * ----------------
 * - `#value` holds the current payload (any type).
 * - `#meta` holds optional structured metadata accumulated across writes.
 * - `set()` replaces the value and shallow-merges metadata.
 * - `clear()` resets both value and metadata.
 *
 * Metadata semantics:
 * -------------------
 * - Metadata is additive (Object.assign).
 * - Intended for tracing, diagnostics, or op-level annotations.
 * - Does NOT affect pipeline execution directly.
 *
 * Serialization:
 * --------------
 * - `toJSON()` returns only the buffer value.
 * - Metadata is intentionally excluded from JSON output.
 *
 * Threading model:
 * ----------------
 * - Buffers are ticket-scoped.
 * - No concurrency control is required.
 * - Engine guarantees single-step execution per ticket.
 *
 * This class is intentionally minimal.
 * It is a foundational primitive for pipeline data flow.
 */

export class Buffer {
    #value = null;
    #meta = {};

    constructor(initial = null) {
	this.#value = initial;
    }

    get() {
	return this.#value;
    }

    set(v, meta) {
	this.#value = v;
	if (meta && typeof meta === "object") {
	    Object.assign(this.#meta, meta);
	}
	return v;
    }

    clear() {
	this.#value = null;
	this.#meta = {};
    }

    meta() {
	return this.#meta;
    }

     toJSON() {
	return this.#value;
    }
}


export default Buffer;


# --- end: class/engine/Buffer.js ---



# --- begin: class/engine/Engine.js ---

/**
 * Engine (Top-Level Runtime Façade)
 * ==================================
 *
 * Public execution entry point for the ActiveTags runtime.
 *
 * The Engine coordinates ticket lifecycle and execution while delegating
 * concrete responsibilities to specialized subsystems:
 *
 * Subsystems
 * ----------
 * @property {EngineState} state
 *   Owns authoritative runtime state and invariants.
 *   Responsible for ticket storage, queues, locks, and lifecycle tracking.
 *
 * @property {Tick} tick
 *   Owns deterministic execution/stepping logic.
 *   Selects the next runnable ticket and advances it one stage via the VM.
 *
 * @property {EngineManager} manager
 *   Owns management and policy APIs.
 *   Responsible for enqueue, cancel, resolution, locking, and queue policy.
 *
 * @property {VM} vm
 *   Executes a single validated pipeline step and returns a StageResult.
 *
 * Design Principles
 * -----------------
 * 1. Thin façade.
 *    Engine exposes the public API surface but does not implement
 *    execution or policy logic directly.
 *
 * 2. Strict separation of concerns.
 *    - EngineState is the single source of truth for runtime data.
 *    - Tick controls deterministic progression.
 *    - EngineManager controls mutation and policy.
 *
 * 3. Ticket-based runtime.
 *    All execution flows through tickets:
 *    `{ job, pipelineKey, inputs, meta, stageState, status }`.
 *
 * 4. Deterministic stepping.
 *    - `tick()` performs at most one unit of work.
 *    - `drain()` repeatedly invokes `tick()` until no runnable work remains
 *      or limits are reached.
 *
 * 5. Observable lifecycle.
 *    Hook surfaces allow instrumentation (enqueue, dequeue, stage,
 *    completion, error) without mutating engine logic.
 *
 * Non-Responsibilities
 * --------------------
 * - Does NOT manage job registration (Registry).
 * - Does NOT perform DOM discovery or configuration (JobConfig).
 * - Does NOT define schema compilation (schema/Master).
 * - Does NOT own higher-level scheduling semantics beyond ticket runtime.
 *
 * Lifecycle Overview
 * ------------------
 * enqueue()  → ticket created + queued
 * tick()     → selects next runnable ticket → VM.step()
 * drain()    → repeated tick() until idle or limit
 * cancel()   → remove ticket(s)
 * lock()     → concurrency gate control
 *
 * The Engine is strictly runtime-oriented. Configuration and identity
 * management are handled by other subsystems.
 *
 * @module Engine
 */

import EngineState   from './EngineState.js';
import EngineManager from './EngineManager.js';

import { Scheduler } from './Scheduler.js';
import { VM }        from './vm/VM.js';
import { Tick }      from './Tick.js';

export class Engine {

    /**
     * Create a new Engine instance.
     *
     * The constructor wires together all runtime subsystems but does not
     * execute any work. The Engine becomes operational once tickets are
     * enqueued and `tick()` / `drain()` are invoked.
     *
     * Dependency Injection Model
     * ---------------------------
     * All major subsystems are injectable to allow:
     * - testing with mocks/fakes
     * - custom schedulers
     * - alternate VM implementations
     * - hook instrumentation
     *
     * If not provided, sane defaults are constructed.
     *
     * @param {Object} args
     *
     * @param {Object} args.lib
     * Required core utility library. Used for hashing, coercion,
     * defensive guards, and internal helpers.
     *
     * @param {JobRegistry} [args.jobRegistry]
     * Optional external job registry used to resolve job-like references
     * into canonical Job instances.
     *
     * @param {VM} [args.vm]
     * Optional VM instance. If omitted, a default VM is constructed.
     *
     * @param {Scheduler} [args.scheduler]
     * Optional runtime scheduler instance. If omitted, a default Scheduler
     * is created and bound to this Engine.
     *
     * @param {ExpressionResolver} [args.expr]
     * Optional expression resolver injected into the default VM.
     *
     * @param {Object} [args.conf]
     * Optional configuration object.
     *
     * @param {Object} [args.conf.hooks]
     * Lifecycle hook callbacks. All hooks are optional.
     *
     * @param {Function} [args.conf.hooks.onEnqueue]
     * Invoked after a ticket is successfully enqueued.
     *
     * @param {Function} [args.conf.hooks.onDequeue]
     * Invoked when a ticket is selected for execution.
     *
     * @param {Function} [args.conf.hooks.onStage]
     * Invoked after a VM stage step completes.
     *
     * @param {Function} [args.conf.hooks.onTicketDone]
     * Invoked when a ticket reaches a terminal state.
     *
     * @param {Function} [args.conf.hooks.onComplete]
     * Invoked when the engine becomes idle after draining.
     *
     * @param {Function} [args.conf.hooks.onError]
     * Invoked when a stage or ticket error occurs.
     *
     * @param {Object} [args.conf.builtins]
     * Optional builtin operation map injected into the default VM.
     *
     * Constructed Subsystems
     * ----------------------
     * @property {EngineState} state
     * Authoritative runtime state container.
     *
     * @property {Scheduler} scheduler
     * Runtime scheduler responsible for queue coordination.
     *
     * @property {VM} vm
     * Pipeline execution virtual machine.
     *
     * @property {EngineManager} manager
     * Policy + coordination layer (enqueue, cancel, locks, etc.).
     *
     * @property {Tick} _tick
     * Deterministic stepping executor.
     *
     * @property {Object} hooks
     * Normalized hook registry (all hooks default to null).
     *
     * @throws {Error}
     * If `lib` is not provided.
     */

    constructor({ lib, jobRegistry, vm, scheduler, conf = {},expr } = {}) {
	if (!lib) throw new Error("Engine requires lib");
	this.lib = lib;
	const hooks    = lib.hash.to(conf.hooks);
	const builtins = lib.hash.to(conf.builtins);
	// external registry (jobLike -> job)
	this.jobRegistry = jobRegistry || null;

	// subsystems
	this.state = new EngineState({ lib });
	this.scheduler = scheduler || new Scheduler({ lib,engine:this });
	this.vm = vm || new VM({ lib, builtins,expr });

	// hooks (optional)
	this.hooks = {
	    onEnqueue: hooks.onEnqueue || null,
	    onDequeue: hooks.onDequeue || null,
	    onStage: hooks.onStage || null,
	    onTicketDone: hooks.onTicketDone || null,
	    onComplete: hooks.onComplete || null,
	    onError: hooks.onError || null,
	};
	//console.log('got hooks', this.hooks);
	// manager (policy + coordination)
	this.manager = new EngineManager({ lib, engine: this });

	// executor (stepping)
	this._tick = new Tick({ lib, engine: this });
    }

    // ---------------------------------------------------------------------------
    // Public execution façade
    // ---------------------------------------------------------------------------

    tick({ ctx = {},ticket=null } = {}) {
	return this._tick.tick({ ctx,ticket });
    }


    async drain({ max = 1000, ticket = undefined, ctx = {}} = {}) {
	let did = 0;

	while (did < max) {
            const res = await this._tick.tick({ ctx, ticket });
            if (!res?.didWork) break;
            did++;
	}

	return did;
    }
    // ---------------------------------------------------------------------------
    // Job resolution (shared helper used by manager/tick)
    // ---------------------------------------------------------------------------
    /**
     * Resolve a job-like reference into a registered Job instance.
     *
     * This is a thin delegation to the injected JobRegistry resolver.
     * Engine does not define or extend resolution semantics.
     *
     * Contract
     * --------
     * - Returns the resolved Job when the reference is recognized.
     * - Returns null when the reference cannot be resolved.
     * - Throws only when the Engine is misconfigured (missing jobRegistry.resolve).
     *
     * Accepted reference forms are defined by the JobRegistry implementation and
     * commonly include:
     * - job id (string)
     * - DOM element
     * - Job instance or job-like object
     *
     * @param {*} jobLike
     *   Reference to resolve.
     *
     * @returns {Job|null}
     *   Resolved Job, or null if not found.
     *
     */
    _resolveJob(jobLike) {
	const jr = this.jobRegistry;
	return jr.resolve(jobLike);
    }

    // ---------------------------------------------------------------------------
    // Management façade (delegates to EngineManager)
    // ---------------------------------------------------------------------------
    //
    // This section intentionally exposes a thin, stable public API surface on
    // Engine while delegating all policy and mutation semantics to EngineManager.
    //
    // These methods do not implement behavior themselves. They forward arguments
    // directly to EngineManager so that:
    // - the Engine façade stays small and readable
    // - policy remains centralized in one subsystem
    // - documentation can live with the true implementation
    //
    // See EngineManager for full contracts and detailed semantics:
    // - getTicketByJob
    // - enqueue
    // - lockTicket / unlockTicket
    // - lock / unlock
    // - cancel / cancelTicket
    // ---------------------------------------------------------------------------
    getTicketByJob(jobLike, key) {
	return this.manager.getTicketByJob(jobLike, key);
    }
    enqueue(jobLike, key = "default", opts = undefined) {
	return this.manager.enqueue(jobLike, key, opts);
    }

    lockTicket(ticketId, lock = undefined) {
	return this.manager.lockTicket(ticketId, lock);
    }

    lock(jobLike, key = "default", lock = undefined) {
	return this.manager.lock(jobLike, key, lock);
    }

    unlockTicket(ticketId, token = undefined) {
	return this.manager.unlockTicket(ticketId, token);
    }

    unlock(jobLike, key = "default", token = undefined) {
	return this.manager.unlock(jobLike, key, token);
    }

    cancel(jobLike, key = "default") {
	return this.manager.cancel(jobLike, key);
    }

    cancelTicket(ticketId) {
	return this.manager.cancelTicket(ticketId);
    }
}

export default Engine;


# --- end: class/engine/Engine.js ---



# --- begin: class/engine/EngineManager.js ---

/**
 * EngineManager
 * =============
 *
 * Policy and coordination layer for the Engine runtime.
 *
 * Role in the architecture
 * ------------------------
 * EngineManager owns all *management semantics* for the runtime:
 * - enqueue
 * - cancel
 * - lock / unlock
 * - ticket lookup
 *
 * It coordinates between:
 * - EngineState   (authoritative runtime state)
 * - Scheduler     (job-level runnable signaling)
 * - Engine        (job resolution + hooks)
 *
 * Clear separation of concerns:
 * - Does NOT own state maps (EngineState is the single source of truth).
 * - Does NOT perform execution/stepping (Tick owns stepping).
 * - Does NOT resolve scheduling order (Scheduler owns runnable policy).
 *
 * Conceptual Model
 * ----------------
 * EngineManager is the mutation boundary of the runtime.
 *
 * All ticket lifecycle transitions originate here:
 * - creation (enqueue)
 * - deduplication (alias model)
 * - cancellation
 * - lock transitions
 *
 * Execution (Tick/VM) consumes what EngineManager prepares.
 *
 * Alias Model
 * -----------
 * Tickets are deduplicated by (jobId + pipelineKey).
 * Each alias maps to at most one active ticket.
 * Enqueueing the same alias returns the existing ticket.
 *
 * Locking Model
 * -------------
 * - Locks are ticket-scoped.
 * - A locked ticket prevents scheduling of additional work for that jobKey.
 * - Unlocking may re-mark the job as runnable if work remains.
 *
 * Cancellation Model
 * ------------------
 * - Cancel removes the ticket from all indexes.
 * - Active tickets are transitioned out safely.
 * - Alias references are cleaned up defensively.
 *
 * Invariants
 * ----------
 * - EngineState is authoritative for ticket storage and alias tracking.
 * - Scheduler is only notified when a job becomes runnable.
 * - No execution is performed here.
 *
 * Design Posture
 * --------------
 * - Deterministic.
 * - Idempotent where possible.
 * - Defensive against stale aliases.
 * - No side-channel mutation of state maps.
 *
 * See also:
 * - EngineState   (runtime storage)
 * - Tick          (execution stepping)
 * - Scheduler     (runnable queue management)
 */

import helpers from './helpers.js';

export class EngineManager {

    /**
     * Create a new EngineManager instance.
     *
     * EngineManager is tightly bound to a single Engine instance and
     * operates as its policy and mutation coordinator.
     *
     * This constructor performs minimal validation and does not allocate
     * runtime state. All authoritative state is owned by EngineState,
     * accessible through the injected Engine.
     *
     * @param {Object} args
     * @param {Object} args.engine
     *   Required Engine instance.
     *   Provides access to:
     *   - engine.state
     *   - engine.scheduler
     *   - engine._resolveJob(...)
     *   - engine hooks
     *
     * @param {Object} [args.lib]
     *   Optional m7 utility library.
     *   Used for coercion, hashing, and defensive normalization.
     *
     * @throws {Error}
     *   If the required `engine` dependency is missing.
     *
     * @notes
     * - EngineManager does not own runtime maps or ticket storage.
     * - EngineManager does not perform stepping or execution.
     * - It is expected to be constructed once per Engine instance.
     */
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this.engine = engine;
	if (!this.engine) throw new Error("EngineManager requires { engine }");
    }

    // ---------------------------------------------------------------------------
    // Resolution helpers (delegates to engine)
    // ---------------------------------------------------------------------------

    /**
     * Resolve a job-like reference into a registered Job instance.
     *
     * Thin delegation to Engine._resolveJob().
     * EngineManager does not implement resolution semantics.
     *
     * @param {*} jobLike
     *   Reference accepted by the Engine’s job registry.
     *
     * @returns {Job|null}
     *   Resolved Job, or null if not found.
     */
    _resolveJob(jobLike) {
	return this.engine._resolveJob(jobLike);
    }

    /**
     * Resolve the active ticket id for a given (job, pipelineKey) alias.
     *
     * This is an internal helper that:
     * 1) Resolves `jobLike` into a Job via Engine.
     * 2) Normalizes the pipeline key (defaults to "default").
     * 3) Queries EngineState alias storage for an existing ticket id.
     *
     * Alias semantics:
     * - Each (jobId + pipelineKey) pair maps to at most one active ticket.
     * - Returns null if:
     *     - the job cannot be resolved
     *     - the job has no id
     *     - no active alias exists
     *
     * @param {*} jobLike
     *   Job reference accepted by the Engine’s resolver.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @returns {string|null}
     *   Active ticket id if present, otherwise null.
     */
    _resolveTicketId(jobLike, key = "default") {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) return null;
	const pipelineKey = String(key || "default");
	return this.engine.state.aliasGet(job.id, pipelineKey);
    }

    // ---------------------------------------------------------------------------
    // Management API (mirrors prior Engine methods)
    // ---------------------------------------------------------------------------

    /**
     * Retrieve active ticket(s) for a given job.
     *
     * This method supports two modes:
     *
     * 1) Specific pipeline key
     *    - When `key` is provided (string), resolves the single ticket
     *      associated with the (jobId + pipelineKey) alias.
     *    - Returns:
     *        - Ticket object if found
     *        - null if no active ticket exists
     *
     * 2) All pipelines
     *    - When `key` is undefined, returns all active tickets
     *      currently associated with the job.
     *    - Returns:
     *        - Array<Ticket> (possibly empty)
     *
     * Resolution flow:
     * - Resolve jobLike → Job
     * - Obtain per-job state bucket from EngineState
     * - Read alias map (pipelineKey → ticketId)
     * - Fetch Ticket objects from EngineState
     *
     * Failure semantics:
     * - If job cannot be resolved:
     *     - returns [] when key is undefined
     *     - returns null when key is specified
     *
     * - If job has no state entry:
     *     - same return behavior as above
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string|undefined} [key]
     *   Pipeline key. When omitted, all active tickets are returned.
     *
     * @returns {Ticket|null|Ticket[]}
     *   - Ticket when key is specified
     *   - null when key specified but not found
     *   - Array<Ticket> when key omitted
     */
    getTicketByJob(jobLike, key = undefined) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) return key === undefined ? [] : null;

	const st = this.engine.state.jobState(job.id);
	if (!st) return key === undefined ? [] : null;

	// CASE 1: key specified > single lookup via alias
	if (typeof key === "string") {
            const pipelineKey = String(key || "default");
            const ticketId = st.alias.get(pipelineKey);
            if (!ticketId) return null;
            return this.engine.state.getTicket(ticketId) || null;
	}

	// CASE 2: no key > return all active tickets for job
	const out = [];
	for (const ticketId of st.alias.values()) {
            const t = this.engine.state.getTicket(ticketId);
            if (t) out.push(t);
	}

	return out;
    }
    
    /**
     * Enqueue a ticket for a given (job, pipelineKey) alias.
     *
     * This is the primary ticket-creation entry point for the runtime.
     * Tickets are deduplicated by alias so that each (jobId + pipelineKey)
     * pair may have at most one active ticket at a time.
     *
     * Alias semantics
     * ---------------
     * - Alias key: (jobId + pipelineKey)
     * - If a ticket already exists for the alias, that existing ticket is returned.
     * - If the alias points at a missing ticket (stale id), the alias is cleared
     *   and a new ticket is created.
     *
     * Queueing semantics
     * ------------------
     * - A newly created ticket is:
     *   1) indexed in EngineState
     *   2) associated with the alias (aliasSet)
     *   3) pushed onto the per-job queue (st.queue)
     *
     * Runnable signaling
     * ------------------
     * After enqueueing, the job is marked runnable when:
     * - the job is not currently active, and
     * - the job is not locked
     *
     * Hooking
     * -------
     * If configured, `engine.hooks.onEnqueue({ job, ticket })` is invoked
     * after successful enqueue.
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for aliasing and ticket identity.
     *
     * @param {Object} [opts]
     * @param {Object} [opts.inputs]
     *   Optional runtime inputs attached to the ticket (event/interval/request context).
     *
     * @param {number} [opts.priority=0]
     *   Optional scheduling priority recorded on the ticket.
     *   (Ordering behavior is determined by Scheduler/Tick policy.)
     *
     * @param {Object} [opts.meta={}]
     *   Optional metadata attached to the ticket for diagnostics and tracing.
     *
     * @returns {Ticket}
     *   The existing ticket (if deduped) or the newly created ticket.
     *
     * @throws {Error}
     *   If `jobLike` cannot be resolved into a Job with a valid `id`.
     */
    enqueue(jobLike, key = "default", { inputs, priority = 0, meta = {} } = {}) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) throw new Error("EngineManager.enqueue requires a resolved job with id");

	const jobId = job.id;
	const pipelineKey = String(key || "default");

	const st = this.engine.state.jobState(jobId);

	// Dedupe via alias: (jobId + pipelineKey) -> ticketId
	const existingId = st.alias.get(pipelineKey);
	if (existingId) {
	    const existing = this.engine.state.getTicket(existingId);
	    if (existing) return existing;
	    st.alias.delete(pipelineKey); // stale alias
	}

	const ticket = helpers.makeRunTicket({job, pipelineKey, inputs, priority, meta });
	//console.log(ticket);
	this.engine.state.indexTicket(jobId, ticket);
	this.engine.state.aliasSet(jobId, pipelineKey, ticket.id);

	st.queue.push(ticket);

	// Mark runnable if not currently running and not locked
	if (!st.active && !this.engine.state.isLockedJobId(jobId)) {
	    this.engine.scheduler.markRunnable(jobId);
	}

	if (this.engine.hooks.onEnqueue) this.engine.hooks.onEnqueue({ job, ticket });
	return ticket;
    }

    // --- locking (tickets are the unique runner)

    /**
     * Apply or update a lock on a specific ticket.
     *
     * Lock semantics
     * --------------
     * - A lock is an opaque object attached to `ticket.lock`.
     * - The presence of a lock indicates the ticket is protected
     *   from certain scheduling or execution transitions
     *   (exact behavior enforced elsewhere in the runtime).
     *
     * Behavior
     * --------
     * - If the ticket record does not exist, this is a no-op and returns 0.
     * - If `lock` is provided, it is assigned directly to `ticket.lock`.
     * - If `lock` is omitted, a default lock object is created:
     *     { type: "ticket", token: "ltk_<timestamp>" }
     *
     * This method does not:
     * - validate lock structure
     * - enforce lock policy
     * - notify scheduler
     *
     * It only mutates ticket state.
     *
     * @param {string} ticketId
     *   Id of the ticket to lock.
     *
     * @param {Object} [lock]
     *   Optional lock descriptor object.
     *
     * @returns {number}
     *   1 if the ticket was found and mutated,
     *   0 if no matching ticket exists.
     */
    lockTicket(ticketId, lock) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	rec.ticket.lock = lock || { type: "ticket", token: `ltk_${Date.now()}` };
	return 1;
    }

    /**
     * Apply a lock to the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `lockTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Applies a lock to that ticket if present.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op.
     * - Locking does not create tickets.
     *
     * Default lock behavior
     * ---------------------
     * - If `lock` is not provided, a default lock object is created:
     *     { type: "jobKey", token: "ljk_<timestamp>" }
     *
     * This method does not:
     * - validate lock structure
     * - enforce lock semantics
     * - notify the scheduler directly
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @param {Object} [lock]
     *   Optional lock descriptor object.
     *
     * @returns {number}
     *   1 if a ticket was found and locked,
     *   0 if no active ticket exists for the alias.
     */
    lock(jobLike, key = "default", lock) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.lockTicket(ticketId, lock || { type: "jobKey", token: `ljk_${Date.now()}` });
    }

    /**
     * Remove a lock from a specific ticket.
     *
     * Unlock semantics
     * ----------------
     * - If the ticket does not exist, this is a no-op and returns 0.
     * - If the ticket has no lock, this is treated as already unlocked and returns 1.
     * - If a `token` is provided and does not match the ticket’s lock token,
     *   the unlock attempt is rejected and returns 0.
     *
     * On successful unlock:
     * - `ticket.lock` is cleared.
     * - If the associated job still has work (active or queued),
     *   the Scheduler is signaled via `markRunnable(jobId)` so it may resume.
     *
     * This method does not:
     * - validate lock structure
     * - guarantee immediate execution
     * - modify alias mappings
     *
     * @param {string} ticketId
     *   Id of the ticket to unlock.
     *
     * @param {string} [token]
     *   Optional lock token. When provided, must match `ticket.lock.token`
     *   to authorize unlock.
     *
     * @returns {number}
     *   1 if unlock succeeded or ticket was already unlocked,
     *   0 if ticket not found or token mismatch.
     */
    unlockTicket(ticketId, token) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const t = rec.ticket;
	if (!t.lock) return 1;

	// token optional; if provided, must match
	if (token && t.lock.token && token !== t.lock.token) return 0;

	t.lock = null;

	// if this job has work, allow scheduler to pick it up again
	const st = this.engine.state.jobs.get(rec.jobId);
	if (st && (st.active || st.queue.length)) this.engine.scheduler.markRunnable(rec.jobId);

	return 1;
    }

    /**
     * Remove a lock from the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `unlockTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Attempts to remove the lock from that ticket.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op and returns 0.
     * - Unlocking does not create tickets.
     *
     * Token semantics
     * ---------------
     * - If a `token` is provided, it must match the ticket’s lock token.
     * - If no token is provided, any existing lock is cleared.
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @param {string} [token]
     *   Optional lock token required to authorize unlock.
     *
     * @returns {number}
     *   1 if unlock succeeded or ticket was already unlocked,
     *   0 if no active ticket exists or token mismatch occurred.
     */
    unlock(jobLike, key = "default", token) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.unlockTicket(ticketId, token);
    }

    // --- cancel

    /**
     * Cancel the active ticket associated with (job, pipelineKey).
     *
     * This is a convenience wrapper around `cancelTicket()` that:
     * 1) Resolves the ticket id via alias (jobId + pipelineKey).
     * 2) Cancels that ticket if present.
     *
     * Alias semantics
     * ---------------
     * - If no active ticket exists for the alias, this is a no-op and returns 0.
     * - Cancellation removes the ticket from runtime state and alias mappings.
     *
     * This method does not:
     * - create tickets
     * - throw on missing jobs
     *
     * @param {*} jobLike
     *   Job reference accepted by Engine resolution.
     *
     * @param {string} [key="default"]
     *   Pipeline key used for alias lookup.
     *
     * @returns {number}
     *   1 if a ticket was found and cancelled,
     *   0 if no active ticket exists for the alias.
     */
    cancel(jobLike, key = "default") {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.cancelTicket(ticketId);
    }

    /**
     * Cancel a ticket by id and remove it from all runtime indexes.
     *
     * Cancellation is a destructive state operation:
     * - The ticket is removed from the global ticket index.
     * - If the ticket is active or queued for its job, it is removed there as well.
     * - Alias mappings are cleaned up defensively to avoid stale pointers.
     *
     * Runtime semantics
     * -----------------
     * - If the ticket record does not exist, returns 0 (no-op).
     * - The global ticket index is always cleared first (`deleteTicket(ticketId)`).
     *
     * Active ticket behavior
     * ----------------------
     * - If the ticket is currently active for the job:
     *   - the alias (jobId + pipelineKey) is cleared if it points to this ticket
     *   - the ticket state is marked `helpers.TICKET_STATE.ERROR` (terminalization marker)
     *   - the job's active slot is cleared
     *   - if queued work remains and the job is not locked, the Scheduler is
     *     signaled via `markRunnable(jobId)`
     *
     * Queued ticket behavior
     * ----------------------
     * - If the ticket is present in the job queue:
     *   - it is removed from the queue
     *   - alias mapping is cleared if it points to this ticket
     *
     * Stale record behavior
     * ---------------------
     * - If the ticket is not found in active or queued slots, the global index
     *   was stale relative to the per-job structures.
     * - Best-effort alias cleanup is still performed when a pipelineKey is known.
     *
     * Notes
     * -----
     * - Cancellation does not attempt to "abort" an executing VM step. It only
     *   removes scheduler visibility and clears state references.
     * - Marking an active ticket `helpers.TICKET_STATE.ERROR` is a deliberate terminal marker to
     *   prevent accidental reuse in downstream logic.
     *
     * @param {string} ticketId
     *   Id of the ticket to cancel.
     *
     * @returns {number}
     *   1 if the ticket was found (or cleaned up best-effort),
     *   0 if no matching ticket record exists.
     */
    cancelTicket(ticketId) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const { jobId, ticket } = rec;
	const st = this.engine.state.jobs.get(jobId);

	// Always clear global ticket index
	this.engine.state.deleteTicket(ticketId);

	if (!st) return 1;

	// Active
	if (st.active && st.active.id === ticketId) {
	    if (st.active.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, st.active.pipelineKey, ticketId);
	    }

	    st.active.state = helpers.TICKET_STATE.ERROR;
	    st.active = null;

	    if (st.queue.length && !this.engine.state.isLockedJobId(jobId)) {
		this.engine.scheduler.markRunnable(jobId);
	    }
	    return 1;
	}

	// Queued
	const before = st.queue.length;
	st.queue = st.queue.filter(x => x.id !== ticketId);

	if (st.queue.length !== before) {
	    if (ticket && ticket.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	    }
	    return 1;
	}

	// If it wasn't in active/queue, index was stale; alias cleanup if possible
	if (ticket && ticket.pipelineKey) {
	    this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	}
	return 1;
    }
}

export default EngineManager;


# --- end: class/engine/EngineManager.js ---



# --- begin: class/engine/EngineState.js ---

/**
 * EngineState
 * -----------
 * Authoritative in-memory runtime state store for the Engine.
 *
 * Role
 * ----
 * EngineState owns the canonical data structures that represent:
 * - per-job execution queues and active ticket assignment
 * - ticket indexing (ticketId -> { jobId, ticket })
 * - alias mappings (jobId + pipelineKey -> ticketId)
 * - minimal lock inspection helpers
 *
 * EngineState is deliberately not a policy layer.
 * It does not schedule, execute, or interpret pipelines.
 * It provides stable primitives used by EngineManager, Tick, and Scheduler.
 *
 * Core invariants
 * ---------------
 * - `jobState(jobId)` is idempotent and will initialize missing job records.
 * - `tickets` is the global index of all known tickets.
 * - Each job record contains:
 *     - queue : Array<ticket>
 *     - active: ticket|null
 *     - alias : Map<pipelineKey, ticketId>
 *
 * Lock semantics
 * --------------
 * - `isLockedJobId(jobId)` considers only the ACTIVE ticket lock.
 * - Locks are treated as opaque objects, with optional expiration:
 *     lock.until (epoch ms)
 * - Expired locks are cleared as a side effect of inspection.
 *
 * This class should remain small and stable.
 * If new policy is needed (eg lock types, cross-job constraints),
 * implement it in EngineManager or Scheduler, not here.
 */

export class EngineState {
    constructor({ lib } = {}) {
	this.lib = lib || null;

	// jobId -> { queue[], active, stats, alias: Map<pipelineKey,ticketId> }
	this.jobs = new Map();

	// ticketId -> { jobId, ticket }
	this.tickets = new Map();
    }

    // --- core job state record

    /**
     * Get (or lazily create) the runtime state bucket for a job.
     *
     * Semantics:
     * - Ensures every referenced `jobId` has a stable state container.
     * - Creation is idempotent and occurs on first access.
     *
     * State shape:
     * - queue  : pending tickets (FIFO per job)
     * - active : currently running ticket (or null)
     * - stats  : lightweight execution metrics
     * - alias  : Map<pipelineKey, ticketId> for dedupe/lookup
     *
     * @param {string} jobId
     * @returns {Object} Job-scoped runtime state container.
     */
    jobState(jobId) {
	let st = this.jobs.get(jobId);
	if (!st) {
	    st = {
		queue: [],
		active: null,
		stats: { runs: 0, errors: 0, lastRunAt: 0 },
		alias: new Map(),
	    };
	    this.jobs.set(jobId, st);
	}
	return st;
    }

    // --- ticket index

    getTicketRec(ticketId) {
	return this.tickets.get(ticketId) || null;
    }

    getTicket(ticketId) {
	const lookup = (typeof ticketId === 'object' && ticketId.id) ? ticketId.id : ticketId;
	    
	const rec = this.tickets.get(lookup);
	return rec ? rec.ticket : null;
    }

    indexTicket(jobId, ticket) {
	this.tickets.set(ticket.id, { jobId, ticket });
	return ticket;
    }

    deleteTicket(ticketId) {
	this.tickets.delete(ticketId);
    }

    // --- alias helpers

    aliasGet(jobId, pipelineKey) {
	const st = this.jobs.get(jobId);
	if (!st) return null;
	return st.alias.get(pipelineKey) || null;
    }

    aliasSet(jobId, pipelineKey, ticketId) {
	const st = this.jobState(jobId);
	st.alias.set(pipelineKey, ticketId);
    }

    aliasDeleteIfPointsTo(jobId, pipelineKey, ticketId) {
	const st = this.jobs.get(jobId);
	if (!st) return;
	if (st.alias.get(pipelineKey) === ticketId) st.alias.delete(pipelineKey);
    }

    // --- lock helpers

    isExpired(lock) {
	return !!(lock && lock.until && Date.now() > lock.until);
    }

    /**
     * Determine whether a job is currently locked from execution.
     *
     * Lock semantics:
     * - Only the ACTIVE ticket can block execution.
     * - If there is no active ticket, the job is not locked.
     * - If the active ticket has no lock, the job is not locked.
     * - If the lock is expired, it is cleared and the job is considered unlocked.
     *
     * This method does not inspect queued tickets.
     *
     * @param {string} jobId
     * @returns {boolean}
     *   True if the job is actively locked and the lock is still valid.
     */
    isLockedJobId(jobId) {
	const st = this.jobs.get(jobId);
	if (!st || !st.active) return false;

	const t = st.active;
	if (!t.lock) return false;

	if (this.isExpired(t.lock)) {
	    t.lock = null;
	    return false;
	}

	return true;
    }
}

export default EngineState;


# --- end: class/engine/EngineState.js ---



# --- begin: class/engine/helpers.js ---

// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------
import Buffer from './Buffer.js';
export const STAGE_STATUS_RANGE = ['ok','wait','error','complete']; 
export const STAGE_STATUS = Object.freeze({
    OK: "ok",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});

/**
 * Canonical ticket lifecycle states.
 *
 * These represent the execution state of a single ticket
 * within the Engine runtime.
 *
 * State flow (typical):
 *   READY → RUNNING → (WAIT | COMPLETE | ERROR)
 *   WAIT  → RUNNING → (WAIT | COMPLETE | ERROR)
 *
 * Notes:
 * - READY     : Enqueued, not yet executing.
 * - RUNNING   : Currently executing a stage.
 * - WAIT      : Suspended awaiting async resolution.
 * - ERROR     : Execution failed (terminal).
 * - COMPLETE  : Execution finished successfully (terminal).
 */
export const TICKET_STATE = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});

export const HOOKS = Object.freeze({
    ENQUEUE  : "onEnqueue",
    DEQUEUE  : "onDequeue",
    STAGE    : "onStage",
    COMPLETE : "onComplete",
    ERROR    : "onError",
    DONE     : "onTicketDone",
});

export const PIPELINE_KEY_DEFAULT  = "default";
export const PIPELINE_PHASE_RUN    = "run";
export const PIPELINE_PHASE_ERROR  = "error";
export const PIPELINE_PHASE        = Object.freeze([PIPELINE_PHASE_RUN,PIPELINE_PHASE_ERROR]);

export function SR_ok(detail) {
    return { status: STAGE_STATUS.OK, detail };
}
export function SR_wait(awaitInfo, detail) {
    return { status: STAGE_STATUS.WAIT, await: awaitInfo || null, detail };
}
export function SR_error(error, detail) {
    return { status: STAGE_STATUS.ERROR, error: error || new Error("Stage error"), detail };
}
export function SR_complete(detail) {
    return { status: STAGE_STATUS.COMPLETE, detail };
}

// -----------------------------------------------------------------------------
// RunTicket (one execution request for a job)
// -----------------------------------------------------------------------------

/**
 * Create a new runtime ticket for executing a pipeline.
 *
 * A ticket represents a single execution instance of:
 *   (jobId + pipelineKey)
 *
 * Tickets are owned and indexed by EngineState and are stepped by the VM
 * via Tick. They are ephemeral runtime records and should not be persisted.
 *
 * Lifecycle:
 * - Initial state: TICKET_STATE.READY
 * - May transition through: running → wait → complete | error
 * - Cancel/lock operations mutate ticket.state or ticket.lock externally.
 *
 * Structural responsibilities:
 * - Identifies the job and pipeline to execute.
 * - Tracks execution cursor (stage pointer).
 * - Carries mutable runtime inputs.
 * - Stores per-run execution artifacts (buffer, last result, await handle).
 *
 * Deduplication:
 * - EngineManager ensures alias-level deduping before creating tickets.
 * - makeRunTicket assumes dedupe has already occurred.
 *
 * @param {Object} args
 * @param {Job} args.job
 *     Resolved Job instance. Must contain a valid `id` and `e`.
 *
 * @param {string} args.pipelineKey
 *     Logical pipeline key to execute.
 *
 * @param {Object} [args.inputs]
 *     Mutable runtime inputs passed into the VM.
 *     These persist for the lifetime of the ticket.
 *
 * @param {number} [args.priority=0]
 *     Scheduling priority. Higher values may be favored by the Scheduler.
 *
 * @param {Object} [args.meta]
 *     Opaque metadata attached to the ticket (diagnostics/hooks).
 *
 * @returns {Object} ticket
 *
 * Ticket shape (v1):
 * - id          : unique runtime ticket id
 * - jobId       : owning job id
 * - createdAt   : timestamp (ms)
 * - priority    : numeric scheduling priority
 * - buffer      : execution buffer (engine Buffer instance)
 * - target      : DOM anchor (job.e)
 * - pipelineKey : pipeline identifier
 * - require     : pipeline dependency list (from schema.require)
 * - cursor      : { stage: number } execution pointer
 * - inputs      : mutable runtime input object
 * - state       : TICKET_STATE.*
 * - last        : last stage result (or null)
 * - await       : wait handle / promise reference (or null)
 * - meta        : opaque metadata
 */

let _ticketCounter = 0;
export function makeRunTicket({ job, pipelineKey, inputs, priority = 0, meta = {} } = {}) {
    const require = job.lib.hash.get(job, "config.schema.require",[]);
    return {
        id: `rt_${++_ticketCounter}`,
        jobId: job.id,
        createdAt: Date.now(),
        priority,
	buffer : new Buffer(),
	target : job.e,
        // what to run (VM expects this)
        pipelineKey: String(pipelineKey || "default"),
	require ,
        // cursor: where we are in the pipeline
        cursor: { stage: 0 },

        // always-mutable run inputs
        inputs: inputs || {},

        // runtime state
        state: TICKET_STATE.READY, 
        last: null,
        await: null,

        meta: meta || {},
    };
}

export default {
    STAGE_STATUS_RANGE,
    STAGE_STATUS,
    PIPELINE_KEY_DEFAULT,
    PIPELINE_PHASE,
    PIPELINE_PHASE_RUN,
    PIPELINE_PHASE_ERROR,
    SR_ok,
    SR_wait,
    SR_error,
    SR_complete,
    makeRunTicket,
    TICKET_STATE,
    HOOKS
};


# --- end: class/engine/helpers.js ---



# --- begin: class/engine/Scheduler.js ---

/**
 * Scheduler
 * =========
 *
 * Fairness and job-selection layer for the Engine.
 *
 * Role in the architecture
 * ------------------------
 * The Scheduler determines *which job runs next*.
 * It does NOT execute pipelines, mutate tickets, or interpret stages.
 * Execution is delegated to Tick / VM.
 *
 * Ordering model
 * --------------
 * - Primary ordering: JOB first (fairness across jobs)
 * - Secondary ordering: handled by EngineState (queue + active ticket)
 *
 * Internally maintains:
 * - `_ready`   : FIFO queue of runnable jobIds
 * - `_present` : Set used to prevent duplicate enqueues
 *
 * A job becomes runnable when:
 * - EngineManager enqueues a ticket
 * - The job is not locked
 * - The job has work (active ticket or queued ticket)
 *
 * Runnable gating
 * ----------------
 * Before returning a jobId from `nextRunnable()`, the Scheduler:
 *
 * 1) Resolves the job live via the JobRegistry
 *    - Jobs may be unloaded/detached at any time.
 *
 * 2) Ensures there is work:
 *    - Prefer `st.active`
 *    - Else peek at `st.queue[0]`
 *
 * 3) Enforces `ticket.require` dependencies
 *    - Each required job must resolve
 *    - Each required job must have `flags.hasRun === true`
 *
 * If gating fails, the job remains in the ready queue.
 *
 * Design constraints
 * ------------------
 * - Stateless with respect to ticket execution.
 * - No global dependency graph.
 * - No mutation of EngineState beyond removing ready entries.
 * - Cheap, predictable, FIFO fairness.
 *
 * Failure posture
 * ---------------
 * - Never throws during scheduling.
 * - Silently drops jobIds that no longer resolve.
 *
 * This class intentionally remains small.
 * Complex orchestration belongs in EngineManager or higher layers.
 */

// -----------------------------------------------------------------------------
// Scheduler (fairness: which job runs next)
// -----------------------------------------------------------------------------

export class Scheduler {
    /**
     * Create a Scheduler instance.
     *
     * The Scheduler is a lightweight fairness queue responsible for selecting
     * which jobId should run next. It does not execute tickets and does not
     * mutate engine state beyond readiness bookkeeping.
     *
     * @param {Object} [args]
     * @param {Object} args.lib
     *   Core utility library. Required.
     *
     * @param {Engine} args.engine
     *   Owning Engine instance. Required.
     *   Used to:
     *   - resolve jobs via the registry
     *   - inspect EngineState for runnable work
     *
     * Internal state initialized:
     * - `_ready`   : Array<string>
     *     FIFO queue of jobIds marked runnable.
     *
     * - `_present` : Set<string>
     *     Tracks which jobIds are already queued to prevent duplicates.
     *
     * @throws {Error}
     *   If `lib` or `engine` is missing.
     */
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this._ready = [];      // FIFO queue of jobIds
	this._present = new Set(); // prevent duplicates in _ready
	this.engine = engine;
	if(!lib || !engine) {
	    throw new Error("scheduler requires lib and engine");
	}
    }

    /**
     * Mark a job as runnable.
     *
     * Adds the given `jobId` to the internal FIFO ready queue
     * if it is not already present.
     *
     * Semantics:
     * - Idempotent: a jobId will only appear once in the ready queue.
     * - No validation is performed on job existence.
     * - Does not execute or inspect the job; it only schedules it
     *   for future selection by the scheduler.
     *
     * @param {string} jobId
     *   Identifier of the job to mark runnable.
     *
     * @returns {void}
     */
    markRunnable(jobId) {
	if (!jobId) return;
	if (this._present.has(jobId)) return;
	this._present.add(jobId);
	this._ready.push(jobId);
    }

    /**
     * Select the next runnable job id from the ready queue.
     *
     * This method implements the Scheduler’s gating logic and returns
     * a single `jobId` that is eligible for execution, or `null`
     * if no job can currently run.
     *
     * Selection algorithm:
     * - Iterates the internal FIFO `_ready` queue.
     * - Live-resolves each `jobId` via `engine.jobRegistry.resolve`.
     *   - If the job no longer exists, it is pruned from the queue.
     *
     * Ticket gating:
     * - For each job:
     *   - Prefer the `active` ticket (if present).
     *   - Otherwise, peek the head of the queued tickets.
     * - If no ticket exists, the job is removed from the ready queue.
     *
     * Require gate:
     * - If the selected ticket declares `require` dependencies,
     *   each dependency is resolved live via the registry.
     * - A dependency is considered satisfied only if:
     *     - the dependent job resolves successfully, and
     *     - `dep.flags.hasRun === true`.
     * - If any requirement is unmet, the job remains in `_ready`
     *   and evaluation continues with the next jobId.
     *
     * Success behavior:
     * - When a runnable job is found:
     *     - It is removed from `_ready`
     *     - Its presence marker is cleared from `_present`
     *     - The `jobId` is returned
     *
     * Failure behavior:
     * - If no runnable job is found, returns `null`.
     *
     * Notes:
     * - This method does not execute the job.
     * - It does not mutate ticket state beyond queue pruning.
     * - It performs live resolution to tolerate dynamic job unloads.
     *
     * @returns {string|null}
     *   The next runnable job id, or null if none are eligible.
     */
    nextRunnable() {
	const engine = this.engine;
	const registry = engine.jobRegistry;

	for (let i = 0; i < this._ready.length; i++) {
            const jobId = this._ready[i];
            if (!jobId) continue;

            // live resolve (jobs may unload)
            const job = registry.resolve(jobId);
            if (!job) {
		// job no longer exists — remove from scheduler
		this._ready.splice(i, 1);
		this._present.delete(jobId);
		i--;
		continue;
            }

	    const st = engine.state.jobState(jobId);

	    // Ticket selection for gating:
	    // - prefer active (already running)
	    // - else peek head of queue (not yet activated)
	    const ticket = st.active || (st.queue && st.queue.length ? st.queue[0] : null);

	    if (!ticket) {
		// nothing to run; jobId should not be in scheduler
		this._ready.splice(i, 1);
		this._present.delete(jobId);
		i--;
		continue;
	    }
	    
            // REQUIRE GATE (live, no global registry)
            if (ticket.require && ticket.require.length) {
		let ok = true;

		for (const reqJobLike of ticket.require) {
                    const dep = registry.resolve(reqJobLike);
                    if (!dep || !dep.flags || dep.flags.hasRun !== true) {
			ok = false;
			break;
                    }
		}

		if (!ok) continue; // cock blocked (requirements not met)
            }

            // Runnable — remove from queue and return
            this._ready.splice(i, 1);
            this._present.delete(jobId);
            return jobId;
	}

	return null;
    }

    /**
     * Legacy fallback implementation of `nextRunnable()`.
     *
     * Performs a simple FIFO dequeue without:
     * - live job resolution
     * - ticket inspection
     * - require/dependency gating
     *
     * Likely deprecated and retained only as a minimal
     * safety fallback or debugging aid.
     *
     * @returns {string|null}
     *   Next queued job id, or null if none.
     */
    //preserve incase the cock blocker fails to function
    basic_nextRunnable() {
	while (this._ready.length) {
	    const jobId = this._ready.shift();
	    this._present.delete(jobId);
	    if (jobId) return jobId;
	}
	return null;
    }

    /**
     * Clear scheduler presence for a specific job id.
     *
     * Semantics:
     * - Removes `jobId` from the internal `_present` set.
     * - Does NOT remove the job id from `_ready` directly.
     * - Allows the job to be re-marked runnable via `markRunnable()`.
     *
     * Design note:
     * - This is a lightweight reset mechanism.
     * - Queue entries are allowed to drain naturally through `nextRunnable()`.
     *
     * @param {string} jobId
     *   Job identifier to clear from scheduler presence tracking.
     *
     * @returns {void}
     */
    clear(jobId) {
	// cheap clear: let it drain naturally; remove presence so it can be re-enqueued
	if (jobId) this._present.delete(jobId);
    }
}





# --- end: class/engine/Scheduler.js ---



# --- begin: class/engine/testHooks.js ---

/**
 * Engine Test / Diagnostic Hooks
 * ===============================
 *
 * Purpose
 * -------
 * Provides a reference implementation of Engine hook callbacks for:
 * - debugging
 * - lifecycle tracing
 * - integration testing
 * - external system instrumentation
 *
 * This module is NOT part of core engine logic.
 * It is an optional observer layer that demonstrates how to subscribe
 * to Engine lifecycle events via `Engine.hooks`.
 *
 * What This File Does
 * -------------------
 * - Implements all supported Engine hook callbacks:
 *     - onEnqueue
 *     - onStage
 *     - onComplete
 *     - onError
 *     - onTicketDone
 * - Emits structured console logs for each lifecycle transition.
 * - Serves as living documentation for hook payload shapes.
 *
 * What This File Does NOT Do
 * --------------------------
 * - Does not modify engine state.
 * - Does not alter ticket execution.
 * - Does not participate in scheduling.
 * - Does not retry, swallow, or mutate errors.
 *
 * Design Role
 * -----------
 * This file is a template and diagnostic tool.
 *
 * It demonstrates:
 * - What hook signatures look like.
 * - When each hook fires.
 * - What data is available at each lifecycle phase.
 *
 * Consumers may:
 * - Replace this implementation entirely.
 * - Partially override selected hooks.
 * - Route hook events into:
 *     - logging frameworks
 *     - analytics systems
 *     - devtools panels
 *     - test assertions
 *     - observability pipelines
 *
 * Configuration
 * -------------
 * Hook wiring is controlled by ActiveTags engine configuration.
 * Hooks may be:
 * - enabled
 * - disabled
 * - overridden
 * - extended
 *
 * This module is inert unless explicitly wired into the Engine configuration.
 *
 * Stability
 * ---------
 * Hook payload contracts should be considered semi-public runtime API.
 * If hook signatures change, this file should be updated accordingly.
 */

export const hooks = {
    /**
     * Fires after enqueue (useful to confirm ticket creation).
     */
    onEnqueue: ({ job, ticket }) => {
	console.log("[AT][enqueue]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    pipelineKey: ticket?.pipelineKey,
	    phase: ticket?.phase,
	});
    },

    /**
     * Fires for every executed stage (only when a stage actually ran).
     * Great for verifying ordering: foo -> bar -> ...
     */
    onStage: (t) => {
	console.log("[AT][stage]", {
	    jobId: t.jobId,
	    ticketId: t.ticketId,
	    phase: t.stage?.phase,
	    pipelineKey: t.pipelineKey,
	    op: t.stage?.opLabel ?? t.stage?.op,
	    stageIndex: t.stage?.stageIndex,
	    status: t.res?.status,
	    reason: t.res?.detail?.reason ?? t.reason ?? null,
	});
    },

    /**
     * Terminal success only.
     * NOTE: This only fires if you added Engine.hooks.onComplete + Tick wiring.
     */
    onComplete: ({ job, ticket, summary }) => {
	console.log("[AT][complete]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    handled: !!summary?.handled,
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    originalError: summary?.originalError || null,
	});
    },

    /**
     * Terminal error only.
     */
    onError: ({ job, ticket, summary }) => {
	console.error("[AT][error]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    phase: summary?.phase,                 // "run" or "onError"
	    pipelineKey: summary?.pipelineKey,
	    error: summary?.error,
	    originalError: summary?.originalError || null,
	    // If onError failed, summary.error is the handler error,
	    // and summary.originalError carries the root cause.
	});
    },

    /**
     * ALWAYS fires once per ticket finalization (this is your "done" / "finally").
     * This is the hook to guarantee cleanup/logging is never missed.
     */
    onTicketDone: ({ job, ticket, summary }) => {
	// "done" == bird cooked: we are terminal now.
	const done = summary?.state === "complete" || summary?.state === "error";

	console.log("[AT][done]", {
	    done,
	    state: summary?.state,         // "complete" | "error"
	    handled: !!summary?.handled,   // true only when recovered via onError
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    jobId: job?.id,
	    ticketId: ticket?.id,
	});

	// Example cleanup place:
	// - release external locks
	// - clear UI busy indicators
	// - finalize logs/metrics
    },
};

export default hooks;


# --- end: class/engine/testHooks.js ---



# --- begin: class/engine/Tick.js ---

/**
 * Tick
 * ----
 * Single-step execution driver for the Engine.
 *
 * Role
 * - Advances the Engine by exactly ONE stage transition.
 * - Selects a runnable job via Scheduler (or targets a specific ticket).
 * - Ensures correct promotion of queued tickets to active.
 * - Enforces job-level and ticket-level locking.
 * - Delegates stage execution to the VM.
 * - Emits standardized hook traces via TickResponse.
 *
 * Conceptual model
 * - Engine is the façade.
 * - EngineState owns authoritative runtime state.
 * - EngineManager owns enqueue/lock/cancel policy.
 * - Scheduler selects runnable jobs.
 * - VM executes one pipeline stage.
 * - Tick orchestrates the above for one atomic step.
 *
 * Execution modes
 * 1) Next-runnable mode (default)
 *    - Pull next jobId from Scheduler.
 *    - Promote queued ticket to active (if needed).
 *    - Execute exactly one stage.
 *
 * 2) Targeted mode (ticket specified)
 *    - Validate the specific ticket id.
 *    - Ensure it is the active ticket (or promote it).
 *    - Execute exactly one stage for that ticket only.
 *
 * Invariants
 * - At most one ACTIVE ticket per job.
 * - A locked job or locked ticket will not execute.
 * - A single call to `tick()` never loops; it advances only one stage.
 * - Terminal transitions (complete/error) clear active state and aliases.
 *
 * Hooks
 * - onDequeue      : when a ticket is promoted from queue → active
 * - onStage        : after every VM step (non-terminal or transition)
 * - onComplete     : when a ticket reaches terminal complete
 * - onError        : when a ticket reaches terminal error
 * - onTicketDone   : uniform terminal hook (complete or error)
 *
 * Trace contract
 * - All outward-facing responses are normalized via TickResponse.
 * - Returned value from `tick()` is always a trace object.
 *
 * Non-responsibilities
 * - Does not enqueue tickets (EngineManager does that).
 * - Does not maintain indexes (EngineState does that).
 * - Does not decide scheduling policy (Scheduler does that).
 * - Does not interpret pipeline semantics (VM does that).
 *
 * This class is the deterministic execution spine of the runtime.
 */

import helpers from './helpers.js';
import TickResponse from './TickResponse.js';

export class Tick {
    constructor({ lib, engine }) {
        this.lib = lib;
        this.engine = engine;
	this.response = new TickResponse({lib});
    }
    
/**
 * Advance the Engine by exactly ONE stage transition.
 *
 * This is the primary execution entry point for the runtime loop.
 * Each call to `tick()` performs at most one VM stage step and
 * returns a normalized trace object describing what happened.
 *
 * Modes of operation
 * ------------------
 * 1) Global mode (default)
 *    - Scheduler selects the next runnable job.
 *    - That job’s ACTIVE ticket (or head of queue) is advanced by one stage.
 *
 * 2) Targeted mode (`ticket` provided)
 *    - Only the specified ticket is advanced.
 *    - Scheduler selection is bypassed.
 *
 * Execution flow
 * --------------
 * 1) Validate and resolve execution context via `_validateTick`.
 *    - May early-return if nothing is runnable.
 *
 * 2) Execute exactly one VM step:
 *        engine.vm.step({ job, ticket, ctx })
 *    - Errors are trapped and converted into a StageResult-like error.
 *
 * 3) Record last result on the ticket (`ticket.last`).
 *
 * 4) Emit `HOOKS.STAGE` after every VM step
 *    - Fired for all outcomes (OK, WAIT, ERROR, COMPLETE).
 *    - Includes terminal transitions.
 *
 * 5) Dispatch to a response handler based on `res.status`:
 *        OK        → `_responseOk`
 *        WAIT      → `_responseWait`
 *        ERROR     → `_responseError`
 *        COMPLETE  → `_responseComplete`
 *        (unknown) → `_responseUnknown`
 *
 * 6) Return a normalized TickResponse trace object.
 *
 * Guarantees
 * ----------
 * - Never advances more than one stage per call.
 * - Never throws VM errors outward; they are normalized.
 * - Always returns a trace object.
 * - Maintains Engine invariants (one active ticket per job).
 *
 * Non-responsibilities
 * --------------------
 * - Does not enqueue tickets (EngineManager handles that).
 * - Does not choose scheduling policy (Scheduler handles that).
 * - Does not mutate configuration.
 *
 * @param {Object} [args]
 * @param {Object} [args.ctx={}]
 *   Optional execution context passed through to VM and ops.
 *
 * @param {string|null} [args.ticket=null]
 *   Optional ticket id for targeted execution.
 *
 * @returns {Promise<Object>}
 *   Normalized tick trace describing the outcome of this step.
 */
    async tick({ ctx = {} ,ticket=null} = {}) {
        const v = this._validateTick({ ctx, ticket });
        if (v.done) return v.res;

        const finalize = this._makeFinalize(v);

        let res;
        try {
            res = await this.engine.vm.step({ job: v.job, ticket: v.ticket, ctx: v.ctx});
        } catch (err) {
	    //console.warn('trap an error');
	    res = helpers.SR_error(err, { pipelineKey: v.ticket?.pipelineKey || null });
            //res = { status: helpers.STAGE_STATUS.ERROR, error: err };
        }
	//console.log(res);
	v.ticket.last = { at: Date.now(), res };
	// build a non-terminal trace for stage events (even if it's a transition OK)
	this._emitOnStage({v,res});
        const env = { ...v, res, finalize };

        const disp = {
            [helpers.STAGE_STATUS.OK]: this._responseOk,
            [helpers.STAGE_STATUS.WAIT]: this._responseWait,
            [helpers.STAGE_STATUS.ERROR]: this._responseError,
            [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
        };

        const handler = disp[res?.status] || this._responseUnknown;
        return handler.call(this, env);
    }
    // best-effort invoke hook; never throws
    _emitHook(name, trace) {
	const fn = this.engine?.hooks?.[name];
	if (typeof fn === "function") fn(trace);
    }
    
    _emitOnStage({v,res}){
	const stageTrace = this.response._makeTickTrace({
	    jobId: v.jobId,
	    job: v.job,
	    ticket: v.ticket,
	    res,
	    summary: null,
	    flags: {
		didWork: true,
		ok: res?.status === helpers.STAGE_STATUS.OK,
		waiting: res?.status === helpers.STAGE_STATUS.WAIT,
		error: res?.status === helpers.STAGE_STATUS.ERROR,
		complete: res?.status === helpers.STAGE_STATUS.COMPLETE,
	    }
	});

	this._emitHook(helpers.HOOKS.STAGE, stageTrace);

    }

    _makeFinalize(env) {
	const { jobId, st, ticket } = env;

	return (finalState) => {
            ticket.state = finalState;

            // drop active
            st.active = null;

            // clear ticket index
            this.engine.state.deleteTicket(ticket.id);

            st.stats.lastRunAt = Date.now();

            // only clear alias on terminal states
            if (ticket.pipelineKey && (finalState === helpers.TICKET_STATE.COMPLETE || finalState === helpers.TICKET_STATE.ERROR)) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
            }
	    
	};
    }

    /**
     * Validate and prepare execution context for a tick.
     *
     * This method determines which execution path to take:
     *
     * - Targeted mode:
     *     If `ticket` is provided, delegates to `_validateTickNamed`
     *     to resolve and validate that specific ticket.
     *
     * - Global mode:
     *     If `ticket` is not provided, delegates to `_validateTickNext`
     *     to select the next runnable job/ticket via the Scheduler.
     *
     * Responsibilities
     * ----------------
     * - Normalize incoming arguments.
     * - Resolve job and ticket context.
     * - Enforce basic invariants (existence, active state, locks).
     * - Produce a standardized validation object consumed by `tick()`.
     *
     * Return contract
     * ---------------
     * Returns a validation object of shape:
     *
     *   {
     *     done: boolean,   // true if no execution should occur
     *     res: Object,     // trace to return immediately if done === true
     *     job: Job,        // resolved job (when done === false)
     *     ticket: Object,  // resolved active ticket
     *     ctx: Object      // normalized execution context
     *   }
     *
     * - If `done === true`, `tick()` must immediately return `res`.
     * - If `done === false`, the returned job/ticket are safe to execute.
     *
     * This method does not execute any VM logic.
     *
     * @param {Object} [args]
     * @param {Object} [args.ctx={}]
     *   Optional execution context passed through to VM.
     *
     * @param {string|null} [args.ticket=null]
     *   Optional ticket id for targeted execution.
     *
     * @returns {Object}
     *   Validation descriptor for the current tick.
     */
    _validateTick({  ctx = {},ticket=null } = {}) {
	return ticket ?
	    this._validateTickNamed({ctx,ticket}):
	    this._validateTickNext({ctx});
    }

    /**
     * Safely resolve a job by id using Engine resolution semantics.
     *
     * This is a consolidation helper that preserves the exact behavior
     * previously duplicated in Tick:
     *  1) Attempt engine._resolveJob(jobId)
     *  2) Fallback to engine._resolveJob({ id: jobId })
     *  3) Swallow resolution errors and return null if unresolved
     *
     * No validation, logging, or side effects are performed here.
     * Callers are responsible for handling missing jobs.
     *
     * @param {string} jobId
     * @returns {Object|null} Resolved job or null if not found
     */
    _resolveJobSafe(jobId) {
	let job = null;
	try {
            job = this.engine._resolveJob(jobId);
	} catch (e1) {
            try { job = this.engine._resolveJob({ id: jobId }); }
            catch (e2) { job = null; }
	}
	return (job && job.id) ? job : null;
    }

    /**
     * Check whether a job is currently locked.
     * Returns a completed tick result if blocked, otherwise null.
     *
     * Caller controls trace shape (ticket inclusion, etc).
     */
    _isJobBlocked({ jobId, job, ticket } = {}) {
	if (!this.engine.state.isLockedJobId(jobId)) return null;

	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		ticket,
		flags: { didWork: false, locked: true, reason: "jobLocked" }
            })
	};
    }

    /**
     * Check whether a ticket is locked and not expired.
     * Clears expired locks.
     * Returns a completed tick result if blocked, otherwise null.
     */
    _isTicketBlocked({ jobId, job, ticket } = {}) {
	if (!ticket || !ticket.lock) return null;

	if (this.engine.state.isExpired(ticket.lock)) {
            ticket.lock = null;
            return null;
	}

	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		ticket,
		flags: { didWork: false, locked: true, reason: "ticketLocked" }
            })
	};
    }

    /**
     * Promote a queued ticket to active if none is active.
     *
     * If ticketId is provided, attempts to promote that specific ticket
     * from the queue (targeted mode).
     *
     * Returns:
     *  - { ticket } on success
     *  - { done, res } if promotion fails in targeted mode
     *  - null if no promotion occurred and no error
     */
    _promoteToActive({ st, jobId, job, ticketId } = {}) {
	if (st.active) return { ticket: st.active };

	// Targeted mode: find specific ticket
	if (ticketId) {
            const idx = st.queue.findIndex(x => x && x.id === ticketId);
            if (idx < 0) {
		return {
                    done: true,
                    res: this.response._makeTickTrace({
			jobId,
			job,
			ticket: this.engine.state.getTicket(ticketId) ,
			flags: { didWork: false, reason: "ticketNotRunnable" }
                    })
		};
            }

            st.active = st.queue.splice(idx, 1)[0];

            const tr = this.response._makeTickTrace({
		jobId,
		job,
		ticket: st.active,
		flags: { didWork: false, reason: "dequeueTarget" }
            });
            this._emitHook(helpers.HOOKS.DEQUEUE, tr);

            return { ticket: st.active };
	}

	// Next-runnable mode: shift from queue
	st.active = st.queue.shift() || null;

	if (st.active) {
            const tr = this.response._makeTickTrace({
		jobId,
		job,
		ticket: st.active,
		flags: { didWork: false, reason: "dequeue" }
            });
            this._emitHook(helpers.HOOKS.DEQUEUE, tr);

            return { ticket: st.active };
	}

	return null;
    }

    /**
     * Ensure st.active is set for this job.
     * - If st.active already exists: returns { ticket: st.active }
     * - Otherwise attempts promotion via _promoteToActive(...)
     * - In targeted mode (ticketId provided), may return { done, res } on failure
     * - In next mode, if still no active ticket, returns { done, res } with reason "empty"
     */
    _ensureActiveTicket({ st, jobId, job, ticketId } = {}) {
	// already active
	if (st.active) return { ticket: st.active };

	// try promote (may return {done,res} in targeted mode)
	const promoted = this._promoteToActive({ st, jobId, job, ticketId });
	if (promoted?.done) return promoted;

	// after promotion attempt, if we have active, return it
	if (st.active) return { ticket: st.active };

	// non-targeted mode: empty queue -> no active
	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		job,
		flags: { didWork: false, empty: true, reason: "empty" }
            })
	};
    }

    _makeRunnable({ jobId, job, st, ticket, ctx } = {}) {
	return { done: false, jobId, job, st, ticket, ctx };
    }

    /**
     * Build a standardized "missing job" tick result.
     * Preserves existing flag differences between named and next modes.
     */
    _makeMissingJob({ jobId, ticket, missingJobFlag = false } = {}) {
	return {
            done: true,
            res: this.response._makeTickTrace({
		jobId,
		ticket: ticket? this.engine.state.getTicket(ticket) || ticket : null,
		flags: {
                    didWork: false,
                    ...(missingJobFlag ? { missingJob: true } : {}),
                    reason: "missingJob"
		}
            })
	};
    }
    
    _validateTickNamed({ ctx = {}, ticket = null } = {}) {
	
	// -----------------------------------------------------------------
	// Targeted mode: tick a specific ticket id (or ticket object)
	// -----------------------------------------------------------------
	if (!ticket)  return {
	    done: true,
	    res: this.response._makeTickTrace({
		flags: { didWork: false, reason: "badTicketArg" }
	    })
	};

        const ticketId = (typeof ticket === "string") ? ticket : ticket.id;
        if (!ticketId) {
	    return { done: true, res: this.response._makeTickTrace({
                flags: { didWork: false, reason: "badTicketArg" }
	    }) };
        }

        const rec = this.engine.state.getTicketRec(ticketId);
        if (!rec || !rec.jobId || !rec.ticket) {
	    return { done: true, res: this.response._makeTickTrace({
                ticket: rec?.ticket || this.engine.state.getTicket(ticketId) || null ,
                flags: { didWork: false, reason: "missingTicket" }
	    }) };
        }

        const jobId = rec.jobId;

	const job = this._resolveJobSafe(jobId);
	if (!job || !job.id)
	    return this._makeMissingJob({
		jobId,
		ticket: rec?.ticket || this.engine.state.getTicket(ticketId) || null
	    });

        const st = this.engine.state.jobState(jobId);

        // If some OTHER ticket is active, do not steal the job mid-run
	
        if (st.active && st.active.id !== ticketId) {
	    return {
		done: true,
		res: this.response._makeTickTrace({
		    jobId,
		    job,
		    ticket: st.active,
		    flags: { didWork: false, reason: "differentActiveTicket" }
		})
	    };
        }


	const ensured = this._ensureActiveTicket({ st, jobId, job, ticketId });
	if (ensured?.done) return ensured;

        // Lock checks (match your global behavior)
	const blocked = this._isJobBlocked({ jobId, job, ticket: st.active });
	if (blocked) return blocked;

	const tBlocked = this._isTicketBlocked({ jobId, job, ticket: st.active });
	if (tBlocked) return tBlocked;

        st.active.state = helpers.TICKET_STATE.RUNNING;
	return this._makeRunnable({ jobId, job, st, ticket: st.active, ctx });
    }
    
    _validateTickNext({ ctx = {} } = {}) {
        const jobId = this.engine.scheduler.nextRunnable();
        if (!jobId)
	    return { done: true, res: this.response._makeTickTrace({ flags: { didWork: false, reason: "noRunnable" } }) };
	
	// Resolve job (jobId is the stringified identity) 
	const job = this._resolveJobSafe(jobId);
	if (!job || !job.id) 
	    return this._makeMissingJob({ jobId, missingJobFlag: true });
	

        // If active ticket is locked, do not run this job now
	const blocked = this._isJobBlocked({ jobId, job });
	if (blocked) return blocked;
	

        const st = this.engine.state.jobState(jobId);

	
	// Ensure there is an active ticket (one active per job)
	const ensured = this._ensureActiveTicket({ st, jobId, job });
	if (ensured?.done) return ensured;
	const ticket = ensured.ticket; // or st.active
	
        // If ticket is locked, do not run
	const tBlocked = this._isTicketBlocked({ jobId, job, ticket });
	if (tBlocked) return tBlocked;
        ticket.state = helpers.TICKET_STATE.RUNNING;
	// no need to tick trace b/c done = false means we continue. done = true means. 'were done'
	return this._makeRunnable({ jobId, job, st, ticket, ctx });
    }


    // -------------------------------------
    // _response*() — mutates ticket state + emits terminal hooks; returns TickResponse trace
    // -------------------------------------
    
    _responseOk(env) {
	const { jobId, job, ticket, res } = env;
	this.engine.scheduler.markRunnable(jobId);

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, ok: true }
	});
    }

    _responseWait(env) {
	const { jobId, job, ticket, res } = env;
	ticket.state = helpers.TICKET_STATE.WAIT;
	ticket.lock = res.lock || res.await || { type: "wait", token: `aw_${Date.now()}` };

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, waiting: true }
	});
    }

    _responseError(env) {
	const { jobId, job, ticket, res, st, finalize } = env;
	st.stats.errors += 1;
	finalize(helpers.TICKET_STATE.ERROR);

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: helpers.TICKET_STATE.ERROR });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, error: true }
	});

	// uniform terminal hooks (same payload)
	this._emitHook(helpers.HOOKS.ERROR, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }

    _responseComplete(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	st.stats.runs += 1;
	finalize(helpers.TICKET_STATE.COMPLETE);

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: helpers.TICKET_STATE.COMPLETE});

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, complete: true }
	});
	this.lib.hash.set(job,"flags.hasRun", true);
	// uniform terminal hooks (same payload)
	this._emitHook(helpers.HOOKS.COMPLETE, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }

    _responseUnknown(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	const err = new Error(`Unknown stage status '${res?.status}'`);
	const sr = helpers.SR_error(err, {
            pipelineKey: res?.detail?.pipelineKey || ticket?.pipelineKey || null,
            phase: ticket?.phase || null,
            unknownStatus: res?.status,
            original: ticket?.errorInfo || null,
	});
	st.stats.errors += 1;
	//always hard fail on things that should exist but dont
	finalize(helpers.TICKET_STATE.ERROR);



	const summary = this.response._makeTerminalSummary({ job, ticket, res: sr, state: helpers.TICKET_STATE.ERROR });

	const trace = this.response._makeTickTrace({
            jobId,
            job,
            ticket,
            res: sr,
            summary,
            flags: { didWork: true, terminal: true, error: true, reason: "unknownStatus" },
	});

	// Uniform terminal hooks
	this._emitHook(helpers.HOOKS.ERROR, trace);
	this._emitHook(helpers.HOOKS.DONE, trace);

	return trace;
    }
}

export default Tick;


# --- end: class/engine/Tick.js ---



# --- begin: class/engine/TickResponse.js ---

/**
 * TickResponse
 * ------------
 * Trace and summary builder for Engine tick execution.
 *
 * Role
 * - Centralizes the construction of a stable, JSON-friendly tick trace payload.
 * - Normalizes per-step metadata (phase, stageIndex, op, step) from StageResult-like objects.
 * - Produces terminal summaries used by hooks and diagnostics.
 *
 * Why this exists
 * - Tick emits multiple hooks with consistent payload shape.
 * - VM/ops may return heterogeneous result shapes; TickResponse extracts “best effort”
 *   fields and returns a uniform envelope.
 * - Keeps Tick logic focused on execution flow, not payload assembly.
 *
 * Output contracts
 * - `_makeTickTrace(...)` returns an object that is safe to log/serialize and stable over time.
 * - Includes both `res` and `result` as aliases for back-compat.
 * - Provides uniform booleans: ok, waiting, complete, error, terminal, locked, missingJob, empty.
 * - Includes `stage` when available; null when not extractable.
 *
 * Terminal summary
 * - `_makeTerminalSummary(...)` returns a compact terminal descriptor for complete/error paths.
 * - Computes `handled` for error-phase recovery semantics (best-effort).
 *
 * Naming and vocabulary (do not conflate)
 * - Pipeline *phase* is one of:
 *     - helpers.PIPELINE_PHASE_RUN   ("run")
 *     - helpers.PIPELINE_PHASE_ERROR ("error")
 *   This is a pipeline routing concept (which pipeline list we are executing).
 *
 * - Engine *hook* keys are separate identifiers, e.g.:
 *     - HOOKS.ERROR ("onError")
 *   This is an event/callback name, not a pipeline phase.
 *
 * Non-responsibilities
 * - Does not mutate engine state, tickets, or jobs.
 * - Does not interpret pipeline semantics.
 * - Does not emit hooks (Tick does that).
 */

import helpers from './helpers.js';
export class TickResponse {
    constructor({lib}) {
	this.lib = lib;
    }
    /**
     * Extract a normalized "stage pointer" from a StageResult-like object.
     *
     * Purpose
     * - Converts heterogeneous result shapes into a stable, minimal descriptor
     *   of "where we are" in the pipeline for logging/tracing.
     *
     * Supported shapes
     * - Standard StageResult:
     *     `res.detail.{ phase, stageIndex, op, opLabel, step }`
     *
     * - Transition results (e.g. "enter error phase"):
     *     `res.detail.from` is treated as the canonical source payload.
     *
     * - Fallback:
     *     When `stageIndex` is not present at the top level, this method
     *     will attempt to read `res.detail.step.stageIndex`.
     *
     * Phase vocabulary
     * - `phase` is one of:
     *     - helpers.PIPELINE_PHASE_RUN   ("run")
     *     - helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * Fallback rules
     * - `phase` falls back to `ticket.phase` when missing.
     * - Missing or non-object `res.detail` returns null.
     *
     * @param {Object} res
     *   StageResult-like object produced by VM/Tick.
     *
     * @param {Object} ticket
     *   Current run ticket (used only for phase fallback).
     *
     * @returns {Object|null}
     *   Normalized stage descriptor:
     *   `{ phase, stageIndex, op, opLabel, step }`,
     *   or null when not extractable.
     */
    _extractStage(res, ticket) {
	const d = res?.detail || null;
	if (!d) return null;

	// Transition result "enter error (helpers.PIPELINE_PHASE_ERROR) phase" carries `from`
	const src = d.from || d;

	return {
            phase: src.phase || ticket?.phase || null,
            //stageIndex: (typeof src.stageIndex === "number") ? src.stageIndex : null,
	    stageIndex:
		(typeof src.stageIndex === "number") ? src.stageIndex :
		(typeof src?.step?.stageIndex === "number") ? src.step.stageIndex :
		null,
            op: (src.op !== undefined) ? src.op : null,
            opLabel: (src.opLabel !== undefined) ? src.opLabel : null,
            step: (src.step !== undefined) ? src.step : null,
	};
    }

    /**
     * Build a normalized tick trace payload.
     *
     * Purpose
     * - Produces a stable, JSON-friendly object describing the outcome of a single
     *   scheduler/tick decision, suitable for:
     *   - engine hooks (HOOKS.STAGE, HOOKS.DONE, HOOKS.COMPLETE, HOOKS.ERROR)
     *   - logging and diagnostics
     *   - test assertions
     *
     * Normalization behavior
     * - Resolves `pipelineKey` from (highest priority first):
     *   1) `res.detail.pipelineKey`
     *   2) `ticket.pipelineKey`
     *   3) `summary.pipelineKey`
     * - Extracts a normalized stage pointer via `_extractStage(res, ticket)`.
     * - Preserves the original StageResult-like value under `res`.
     * - Duplicates `res` into `result` for backwards compatibility.
     * - Surfaces uniform booleans derived from `flags` so callers can test state
     *   without inspecting StageResult internals.
     *
     * Output shape
     * - Returned object contains:
     *   - core identifiers: jobId, ticketId, pipelineKey
     *   - execution metadata: didWork, return_status
     *   - stage pointer: stage (nullable)
     *   - raw result: res + result alias
     *   - terminal info: terminal + summary
     *   - convenience booleans: ok, waiting, complete, error
     *   - meta reasons: reason, locked, missingJob, empty
     *
     * Notes
     * - This function does not emit hooks; it only builds payloads consumed by Tick.
     * - Pipeline *phase* is carried inside `stage.phase` and uses:
     *     - helpers.PIPELINE_PHASE_RUN   ("run")
     *     - helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * @param {Object} [args]
     * @param {string|null} [args.jobId]
     *   Explicit job id (overrides job.id if provided).
     * @param {Job|null} [args.job]
     *   Resolved job instance (optional; used for id fallback).
     * @param {Object|null} [args.ticket]
     *   Current run ticket (optional; used for id and pipelineKey fallbacks).
     * @param {Object|null} [args.res]
     *   StageResult-like object returned from VM/Tick (may be null).
     * @param {Object|null} [args.summary]
     *   Terminal summary object (only meaningful when `flags.terminal` is true).
     * @param {Object|null} [args.flags]
     *   Normalized boolean flags produced by Tick (didWork, ok, waiting, complete,
     *   error, terminal, locked, missingJob, empty) plus optional `reason`.
     *
     * @returns {Object}
     *   Normalized trace payload.
     */
    _makeTickTrace({ jobId = null, job = null,  ticket = null, res = null, summary = null, flags = null } = {}) {
	const d = res?.detail || null;

	const pipelineKey =
              d?.pipelineKey ||
              ticket?.pipelineKey ||
              summary?.pipelineKey ||
              null;

	const stage = this._extractStage(res, ticket);

	const trace = {
            // core
            didWork: !!(flags?.didWork),
            jobId: jobId || job?.id || null,
            ticketId: ticket?.id || null,
            pipelineKey,
	    
	    //the normalized return code from the function call.
	    return_status: res?.return_status || null,

            // stage + result
            stage,        // may be null
            res: res || null,      // canonical name
            result: res || null,   // back-compat alias

            // terminal
            terminal: !!(flags?.terminal),
            summary: summary || null,

            // convenience flags (uniform)
            ok: !!(flags?.ok),
            waiting: !!(flags?.waiting),
            complete: !!(flags?.complete),
            error: !!(flags?.error),

            // meta reasons (uniform)
            reason: flags?.reason || null,
            locked: !!(flags?.locked),
            missingJob: !!(flags?.missingJob),
            empty: !!(flags?.empty),
	};

	return trace;
    }

    /**
     * Build a compact terminal summary for a finished ticket.
     *
     * Purpose
     * - Produces a minimal, stable descriptor for terminal ticket outcomes that can be emitted
     *   to hooks and logs.
     * - Encapsulates recovery semantics (error-phase handling) in one place.
     *
     * Terminal states
     * - `state` is authoritative and is expected to be one of:
     *     - helpers.TICKET_STATE.COMPLETE ("complete")
     *     - helpers.TICKET_STATE.ERROR    ("error")
     *
     * Phase resolution
     * - `phase` is resolved (highest priority first) from:
     *     1) `ticket.phase`
     *     2) `res.detail.phase`
     *     3) helpers.PIPELINE_PHASE_RUN ("run")
     *
     * Pipeline key resolution
     * - `pipelineKey` is resolved best-effort from:
     *     1) `ticket.pipelineKey`
     *     2) `res.detail.pipelineKey`
     *
     * Error recovery detection
     * - `handled` is true when:
     *     - state === helpers.TICKET_STATE.COMPLETE, AND
     *     - either:
     *         a) `res.detail.handled === true`, OR
     *         b) `phase === helpers.PIPELINE_PHASE_ERROR`
     * - This indicates the pipeline entered the error phase but ultimately completed successfully.
     *
     * Error payloads
     * - `originalError` is sourced from `ticket.errorInfo` (if present).
     * - `error` is included only when `state === helpers.TICKET_STATE.ERROR`,
     *   and is taken from `res.error`.
     * - The full `res` object is preserved for downstream inspection.
     *
     * @param {Object} args
     * @param {Job} args.job
     *   Resolved job instance (currently informational; not directly used).
     * @param {Object} args.ticket
     *   Ticket associated with this terminal state.
     * @param {Object} args.res
     *   StageResult-like object returned from the VM.
     * @param {string} args.state
     *   Final terminal state for this ticket (helpers.TICKET_STATE.COMPLETE | helpers.TICKET_STATE.ERROR).
     *
     * @returns {Object}
     *   Terminal summary:
     *   {
     *     state,
     *     phase,
     *     handled,
     *     pipelineKey,
     *     originalError,
     *     error,
     *     res
     *   }
     */
    _makeTerminalSummary({ job, ticket, res, state }) {
	const detail = (res && typeof res === "object") ? (res.detail || {}) : {};
	const phase = ticket?.phase || detail.phase || helpers.PIPELINE_PHASE_RUN;
	const pipelineKey =
              ticket?.pipelineKey ||
              detail.pipelineKey ||
              null;

	const handled =
              state === helpers.TICKET_STATE.COMPLETE &&
              (detail.handled === true || phase === helpers.PIPELINE_PHASE_ERROR);

	return {
            // Ticket terminal state
            // One of: helpers.TICKET_STATE.COMPLETE ("complete") | helpers.TICKET_STATE.ERROR ("error")
            state,

            // Pipeline phase (do not confuse with hook names)
            // One of: helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
            phase,

            // Best-effort recovery indicator:
            // true if the completion occurred after entering the error phase, or if the op marked handled=true.
            handled,

            // Best-effort pipelineKey at time of termination
            pipelineKey,

            // Original error captured on ticket (if any)
            originalError: ticket?.errorInfo || null,

            // Error object only when terminal state is ERROR
            error: state === helpers.TICKET_STATE.ERROR ? (res?.error || null) : null,

            // Raw StageResult-like object
            res,
	};
    }
    
}
export default TickResponse;


# --- end: class/engine/TickResponse.js ---



# --- begin: class/engine/vm/OP.js ---

/**
 * OP (Operation Normalizer)
 * ==========================
 * Formalizes and normalizes raw stage return values into canonical StageResult objects.
 *
 * Role
 * ----
 * - Converts arbitrary user function return values into explicit
 *   helpers.SR_* StageResults.
 * - Eliminates implicit continuation semantics.
 * - Enforces explicit control flow signaling for OK / WAIT / ERROR / COMPLETE.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (lifecycle + scheduling)
 *       → VM (single-stage execution)
 *           → OP (return normalization only)
 *
 * OP does NOT:
 * - Execute stage functions
 * - Mutate tickets
 * - Manage phase transitions
 * - Emit hooks
 * - Perform scheduling
 *
 * Design Philosophy
 * -----------------
 * - Control flow must be explicit.
 * - Truthy values do NOT imply continuation.
 * - Legacy behavior is recognized but coerced into explicit helpers.SR_* results.
 * - All outcomes are reduced to helpers.STAGE_STATUS.*.
 *
 * Normalization Rules (v1)
 * ------------------------
 * Scalar values:
 *   - If lib.bool.yes(value) → helpers.SR_ok (continue)
 *   - Otherwise              → helpers.SR_error
 *
 * Object values:
 *   - If `status` is an intentional bool (lib.bool.isIntent) →
 *       coerced to helpers.STAGE_STATUS.OK or ERROR
 *   - If `status` is already in helpers.STAGE_STATUS_RANGE →
 *       passed through (cloned)
 *   - If `{ wait: true }` →
 *       coerced to helpers.SR_wait (legacy compatibility)
 *
 * All other values:
 *   → helpers.SR_error
 *
 * Guarantees
 * ----------
 * - Always returns a StageResult-like object.
 * - Never throws.
 * - Never mutates ticket or engine state.
 * - Preserves `pipelineKey` and `op` metadata when provided.
 *
 * Notes
 * -----
 * - This module is intentionally coercive and opinionated.
 */

import helpers from '../helpers.js';

export class OP {
    constructor({lib}) {
	this.lib = lib;
    }

    /**
     * Produce a stable, human-readable label for an operation.
     *
     * Used for logging, tracing, and hook metadata.
     * Returns a best-effort string representation based on:
     *   - string ops → returned directly
     *   - function ops → function name or "(anonymous fn)"
     *   - object ops → constructor name or "(object op)"
     *   - null / other types → descriptive fallback
     *
     * Does not mutate input.
     *
     * @param {*} op
     *   Operation identifier (string | function | object | null).
     *
     * @returns {string}
     *   Safe label suitable for logs and diagnostics.
     */
    _opLabel(op) {
	// Prefer stable human-readable labels for logs/hooks.
	if (typeof op === "string") return op;

	if (typeof op === "function") {
            return op.name && op.name.length ? op.name : "(anonymous fn)";
	}

	if (op && typeof op === "object") {
            // Constructor name if meaningful
            const ctor = op.constructor && op.constructor.name;
            if (ctor && ctor !== "Object") return ctor;
            // Fallback
            return "(object op)";
	}

	if (op === null) return "(null op)";
	return `(${typeof op} op)`;
    }

    /**
     * Normalize a raw stage return value into a canonical StageResult.
     *
     * This method enforces explicit control-flow signaling by coercing
     * arbitrary return values into helpers.SR_* objects.
     *
     * Normalization rules
     * -------------------
     * 1) Scalar values:
     *    - If `lib.bool.yes(value)` → helpers.SR_ok
     *    - Otherwise                → helpers.SR_error
     *
     * 2) Object values:
     *    - If `status` is a bool-intent (`lib.bool.isIntent`) →
     *        coerced to:
     *          helpers.STAGE_STATUS.OK
     *          helpers.STAGE_STATUS.ERROR
     *
     *    - If `status` is already in helpers.STAGE_STATUS_RANGE →
     *        returned as a shallow clone.
     *
     *    - If `{ wait: true }` →
     *        coerced to helpers.SR_wait (legacy compatibility).
     *
     * 3) All other values:
     *    → helpers.SR_error
     *
     * Guarantees
     * ----------
     * - Always returns a StageResult-like object.
     * - Never throws.
     * - Does not mutate ticket or engine state.
     * - Preserves `pipelineKey` and `op` metadata when provided.
     *
     * @param {*} res
     *   Raw value returned by a stage function.
     *
     * @param {Object} [opts]
     * @param {string} [opts.pipelineKey]
     *   Pipeline identifier for diagnostics.
     * @param {*} [opts.op]
     *   Operation identifier for diagnostics.
     *
     * @returns {Object}
     *   A StageResult object produced via helpers.SR_ok / SR_wait / SR_error.
     */    
    _normalizeReturn(res, { pipelineKey, op } = {}) {
	if (this.lib.utils.isScalar(res)) {

	    // Explicit continue
	    if (this.lib.bool.yes(res)) {
		return helpers.SR_ok({ pipelineKey, op, legacy: true, value: res });
	    }

	    // Scalar but not recognized as continue => error
	    return helpers.SR_error(
		new Error("Stage returned falsy or unrecognized scalar"),
		{ pipelineKey, op, legacy: true, value: res }
	    );
	}
	
	//console.log('normaled resp', res);
	//base type will differentiate null, array, (object, hash) => object
	if(this.lib.utils.baseType(res,'object')) {
	    // Already a StageResult ... return new object in order to minimize fuckery in user func.
	    const status = res.status;
	    // Coerce boolish legacy status FIRST 
	    if (this.lib.bool.isIntent(status)) {
		const coerced = this.lib.bool.yes(status)
		      ? helpers.STAGE_STATUS.OK
		      : helpers.STAGE_STATUS.ERROR;
		return { ...res, status: coerced };
	    }
	    
	    // Accept canonical StageResult statuses 
	    if (helpers.STAGE_STATUS_RANGE.includes(status)) 
		return {...res};

	    
	    //console.log('invalid status... ', res.status);
	    // Explicit legacy wait
	    if (res.wait === true) {
		return helpers.SR_wait({
		    pipelineKey,
		    op,
		    legacy: true,
		    value: res.value ?? null,
		    await: res.await ?? null,
		});
	    }
	}

        return helpers.SR_error(
	    new Error("Stage returned value with no recognized continuation semantics"),
	    { pipelineKey, op, legacy: true, value:res }
        );
    }
    

}

export default OP;


# --- end: class/engine/vm/OP.js ---



# --- begin: class/engine/vm/Validate.js ---

/**
 * Validate (VM Step Resolver)
 * ============================
 * Resolves pipeline configuration and stage metadata for a single VM step.
 *
 * Role
 * ----
 * - Ensures ticket runtime fields exist.
 * - Resolves pipeline definition by key.
 * - Selects the correct phase track (run | error).
 * - Determines the current stage record.
 * - Resolves the operation and executable function.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (lifecycle + scheduling)
 *       → VM (single-stage execution)
 *           → Validate (pipeline + stage resolution only)
 *
 * Validate does NOT:
 * - Execute stage functions
 * - Normalize return values
 * - Mutate ticket phase transitions
 * - Finalize tickets
 * - Emit hooks
 *
 * Phase Semantics
 * ---------------
 * - Phase must be one of:
 *     helpers.PIPELINE_PHASE_RUN   ("run")
 *     helpers.PIPELINE_PHASE_ERROR ("error")
 *
 * - `_getSteps()` selects the correct phase track from the pipeline
 *   definition based on the ticket's current phase.
 *
 * Step Resolution Flow
 * --------------------
 * `_validateStep({ job, ticket })` performs:
 *
 * 1) Resolve pipeline definition via `ticket.pipelineKey`
 *    (defaults to helpers.PIPELINE_KEY_DEFAULT ("default")).
 *
 * 2) Resolve steps for the current phase.
 *
 * 3) Determine current stage by `ticket.cursor.stage`.
 *
 * 4) If stage does not exist:
 *      - If in error phase → return handled completion.
 *      - Otherwise         → return normal completion.
 *
 * 5) Resolve:
 *      - operation identifier
 *      - operation function (builtins → lib.func registry)
 *
 * 6) Return either:
 *      - `{ err }`   → StageResult error
 *      - `{ done }`  → StageResult complete
 *      - executable stage metadata:
 *          { pipelineKey, pipelineDef, steps, stepRec, op, args, fn }
 *
 * Guarantees
 * ----------
 * - Never throws.
 * - Does not mutate job or engine state.
 * - May mutate ticket runtime fields via `_ensureTicketRuntime`.
 * - Always returns a structured descriptor for VM consumption.
 *
 * Notes
 * -----
 * - This module assumes prior normalization of job configuration.
 */

import helpers from '../helpers.js';

export class Validate {
    constructor({lib,builtins} ) {
	this.lib = lib;
	this.builtins = builtins;
    }

    //leaving this 'raw', b/c I havent decided if I will make tickets an class entity rather than a raw hash.
    //also this should be ideally groomed above and reject invalid ticket shapes.
    /**
     * Ensure minimal runtime shape for a ticket.
     *
     * Initializes fields required by VM execution:
     *   - ticket.cursor.stage (number)
     *   - ticket.phase (helpers.PIPELINE_PHASE_RUN | helpers.PIPELINE_PHASE_ERROR)
     *   - ticket.errorInfo (nullable)
     *
     * This is defensive grooming only. It does not validate
     * the full ticket structure or enforce schema correctness.
     *
     * Mutates the provided ticket object in-place.
     */
    _ensureTicketRuntime(ticket) {
	// Minimal runtime fields for the runner.
	if (!ticket.cursor || typeof ticket.cursor !== "object") ticket.cursor = {};
	if (typeof ticket.cursor.stage !== "number") ticket.cursor.stage = 0;

	// phase: "run" or "error"
	if (!ticket.phase) ticket.phase = helpers.PIPELINE_PHASE_RUN;

	// keep original error when transitioning into error
	if (!ticket.errorInfo) ticket.errorInfo = null;
    }


    /**
     * Resolve a pipeline definition from a job by key.
     *
     * Lookup path:
     *   job.config.schema.pipelines[key]
     *
     * Defaults to helpers.PIPELINE_KEY_DEFAULT ("default") when `pipelineKey` is nullish.
     *
     * @param {Object} job
     * @param {string} pipelineKey
     * @returns {Object|null}
     *   Pipeline definition object, or null if missing.
     */
    _getPipelineDef(job, pipelineKey) {
	if (!job) return null;

	const key = String(pipelineKey || helpers.PIPELINE_KEY_DEFAULT);
	return this.lib.hash.get(job, `config.schema.pipelines.${key}`, null);
    }
    
    /**
     * Resolve the step list for the given pipeline phase.
     *
     * Validates that `phase` is one of:
     *   helpers.PIPELINE_PHASE_RUN | helpers.PIPELINE_PHASE_ERROR
     *
     * Returns the corresponding step array from the pipeline
     * definition, or null if invalid/missing.
     */
    
    _getSteps(pipelineDef, phase) {
	if (!pipelineDef) return null;

	const lib = this.lib;
	const allowed = lib.utils.clamp(helpers.PIPELINE_PHASE, phase, null);
	if (!allowed) return null;

	// `allowed` is "run" or "error"
	return lib.hash.get(pipelineDef, allowed, null);
    }
    /**
     * Normalize a raw pipeline step into `{ op, args }`.
     *
     * Accepts either:
     *   - string shorthand (e.g. "request.submit")
     *   - object form (e.g. { op: "request.submit", ... })
     *
     * Returns a normalized descriptor with:
     *   - op   (string | null)
     *   - args (object | null)
     *   - raw  (original step value)
     */

    _resolveStage(step) {
	// step can be:
	// - "request.submit"
	// - { op:"request.submit", ... }
	let rec = this.lib.hash.to(step, "op");
	return { op: rec.op || null, args: rec.args || null, raw: step };
    }

    /**
     * Resolve an operation function by name.
     *
     * Resolution order:
     *   1) builtins registry (explicit overrides)
     *   2) lib.func registry
     *
     * Returns the resolved function or null/undefined if not found.
     */
    _getFn(fn){
	const builtin = this.lib.hash.get(this.builtins,fn,null);
	if(builtin) return builtin;
	return this.lib.func.get(fn);
    }

    /**
     * Resolve and validate the next executable stage for a ticket.
     *
     * Contract
     * --------
     * - Pure resolver for VM: determines what should run next (or why it cannot).
     * - Does NOT execute ops, normalize returns, transition phases, or emit hooks.
     * - May return either:
     *     A) error descriptor   → `{ err: StageResultError, ... }`
     *     B) completion         → `{ done: true, complete: true, res: StageResultComplete, ... }`
     *     C) executable context → `{ err: null, pipelineKey, pipelineDef, steps, stepRec, op, args, fn }`
     *
     * Inputs
     * ------
     * - `ticket.pipelineKey` selects the pipeline (defaults to helpers.PIPELINE_KEY_DEFAULT ("default") ).
     * - `ticket.phase` selects the phase track:
     *     helpers.PIPELINE_PHASE_RUN ("run") |
     *     helpers.PIPELINE_PHASE_ERROR ("error")
     * - `ticket.cursor.stage` selects the stage index within the phase track.
     *
     * Resolution order
     * ----------------
     * 1) Resolve pipeline definition via `_getPipelineDef(job, pipelineKey)`.
     *    - If missing → returns `{ err }` (Missing pipeline).
     *
     * 2) Resolve phase step list via `_getSteps(pipelineDef, ticket.phase)`.
     *    - If invalid/missing → returns `{ err, pipelineDef }` (Invalid pipeline definition).
     *
     * 3) Resolve current step record by index:
     *      `stepRec = steps[ticket.cursor.stage]`
     *
     * 4) End-of-phase handling (no step record):
     *    - If `ticket.phase === helpers.PIPELINE_PHASE_ERROR`:
     *        returns a handled completion via `helpers.SR_complete({ handled:true, original: ticket.errorInfo })`.
     *    - Otherwise:
     *        returns a normal completion via `helpers.SR_complete({ handled:false })`.
     *
     * 5) Resolve operation descriptor via `_resolveStage(stepRec)`:
     *    - If missing `op` → returns `{ err, stepRec }` (Invalid step).
     *
     * 6) Resolve executable function via `_getFn(op)`:
     *    - If not found → returns `{ err, op, stepRec }` (Unknown op).
     *
     * Output notes
     * ------------
     * - `pipelineDef`, `steps`, and `stepRec` are returned for diagnostic context.
     * - Completion results include `pipelineKey`, `phase`, and `handled` flags.
     * - The VM is expected to feed `{ err }` and `{ done }` outcomes through the
     *   normal status dispatch (no early returns).
     *
     * @param {Object} args
     * @param {Object} args.job
     *   Job containing pipeline configuration under `job.config.schema.pipelines`.
     * @param {Object} args.ticket
     *   Ticket providing pipelineKey/phase/cursor.stage selectors.
     *
     * @returns {Object}
     *   One of:
     *   - Error: `{ err: StageResultError, pipelineKey, pipelineDef?, steps?, stepRec?, op? }`
     *   - Done:  `{ done:true, complete:true, res: StageResultComplete, pipelineKey, pipelineDef, steps }`
     *   - Exec:  `{ err:null, pipelineKey, pipelineDef, steps, stepRec, op, args, fn }`
     */
    
    _validateStep({ job, ticket }) {
	const pipelineKey = String(ticket.pipelineKey || helpers.PIPELINE_KEY_DEFAULT);
	
	const pipelineDef = this._getPipelineDef(job, pipelineKey);
	if (!pipelineDef) {
	    return {
		err: helpers.SR_error(new Error(`Missing pipeline '${pipelineKey}'`), { pipelineKey }),
		pipelineKey,
	    };
	}

	const steps = this._getSteps(pipelineDef, ticket.phase);
	if (!steps) {
	    return {
		err: helpers.SR_error(new Error(`Invalid pipeline '${pipelineKey}' definition`), {
		    pipelineKey,
		    phase: ticket.phase,
		}),
		pipelineKey,
		pipelineDef,
	    };
	}

	const stepRec = steps[ticket.cursor.stage];
	//console.log(`stage is ${ticket.cursor.stage}`);
	// End-of-phase
	if (!stepRec) {
	    // If we've exhausted the error track, we treat this as a *handled* completion.
	    if (ticket.phase === helpers.PIPELINE_PHASE_ERROR) {
		return {
		    done: true,
		    complete: true,
		    res: helpers.SR_complete({
			pipelineKey,
			phase: helpers.PIPELINE_PHASE_ERROR,
			handled: true,
			original: ticket.errorInfo || null,
		    }),
		    pipelineKey,
		    pipelineDef,
		    steps,
		};
	    }

	    // Normal run end-of-line: clean completion.
	    return {
		done: true,
		complete: true,
		res: helpers.SR_complete({
		    pipelineKey,
		    phase: ticket.phase,
		    handled: false,
		}),
		pipelineKey,
		pipelineDef,
		steps,
	    };
	}
	const { op, args } = this._resolveStage(stepRec);
	if (!op) {
	    return {
		err: helpers.SR_error(new Error("Invalid pipeline step (missing op)"), { pipelineKey, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
	    };
	}

	const fn = this._getFn(op);
	if (!fn) {
	    return {
		err: helpers.SR_error(new Error(`Unknown op '${op}'`), { pipelineKey, op, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
		op,
	    };
	}

	return {
	    err: null,
	    pipelineKey,
	    pipelineDef,
	    steps,
	    stepRec,
	    op,
	    args,
	    fn,
	};
    }

    
}

export default Validate;


# --- end: class/engine/vm/Validate.js ---



# --- begin: class/engine/vm/VM.js ---

/**
 * VM (Virtual Machine)
 * ====================
 * Deterministic, single-step execution engine for a single ticket.
 *
 * Role
 * ----
 * - Executes exactly ONE pipeline stage transition per call.
 * - Applies validation, op execution, normalization, and phase routing.
 * - Produces a canonical StageResult object consumed by Tick.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (scheduler + lifecycle control)
 *       → VM (pure stage execution)
 *           → Validate (pipeline + step resolution)
 *           → OP (return normalization + labeling)
 *
 * The VM does NOT:
 * - Schedule tickets
 * - Finalize tickets
 * - Emit hooks
 * - Mutate engine state outside the active ticket
 *
 * Execution Model
 * ---------------
 * `step({ job, ticket, ctx })` performs:
 *
 * 1) Runtime grooming
 *    - Ensures ticket has required runtime fields
 *      (cursor, phase, errorInfo).
 *
 * 2) Validation
 *    - Resolves pipeline definition by key.
 *    - Resolves current phase:  helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
 *    - Resolves current stage and operation.
 *    - Produces either:
 *        - `err`  → StageResult error
 *        - `done` → StageResult complete
 *        - or executable stage metadata
 *
 * 3) Stage execution (if applicable)
 *    - Materializes arguments via `expr`.
 *    - Invokes stage function.
 *    - Catches thrown errors and converts to `SR_error`.
 *    - Normalizes return value via OP._normalizeReturn().
 *
 * 4) Stage identity stamping
 *    - Snapshots pre-mutation execution identity:
 *        { phase, stageIndex, pipelineKey, op, step }
 *    - Injects stable metadata into `res.detail`
 *      to preserve stage identity across transitions.
 *
 * 5) Status dispatch
 *    - OK       → advance cursor
 *    - WAIT     → no cursor change
 *    - COMPLETE → emit early completion StageResult
 *    - ERROR    → apply error-phase routing semantics
 *    - Unknown  → converted to SR_error
 *
 * Phase Semantics
 * ---------------
 * - Phase is one of:
 *     helpers.PIPELINE_PHASE_RUN   ("run")
 *     helpers.PIPELINE_PHASE_ERROR ("error")
 *
 * - When a stage fails:
 *     - If an error-phase pipeline exists, transition into it.
 *     - Otherwise, return a terminal error StageResult.
 *
 * - If already in PIPELINE_PHASE_ERROR and a stage fails,
 *   the error is terminal and annotated as handler failure.
 *
 * Return Contract
 * ---------------
 * `step()` returns a normalized StageResult-like object:
 *
 *   {
 *     status: helpers.STAGE_STATUS.*,
 *     detail: { ...stable metadata... },
 *     error?: Error
 *   }
 *
 * Additionally:
 * - `return_status` is attached to the returned object
 *   and reflects the raw status BEFORE any transition
 *   (e.g., before entering error phase).
 *
 * Determinism Guarantees
 * ----------------------
 * - Executes at most one stage.
 * - Never throws outward.
 * - Always returns a StageResult-like object.
 * - Only mutates:
 *     - ticket.phase
 *     - ticket.cursor.stage
 *     - ticket.errorInfo
 *
 * This class is intentionally side-effect minimal and
 * scheduling-agnostic.
 */

import helpers from '../helpers.js';
import Validate from './Validate.js';
import OP       from './OP.js';

export class VM {
    constructor({ lib, builtins,expr } = {}) {
	if(!lib)       throw new Error("PASS lib :) ");
	this.lib       = lib ;
	this.builtins  = builtins || {}; //this is unnecessary but the AI bitches when I lint, b/c it seems to have trouble reading my libs.
	this.validator = new Validate({lib,builtins});
	this.op        = new OP({lib});
	this.expr      = expr;
    }


    /**
     * Execute exactly ONE pipeline stage transition for a ticket.
     *
     * This is the core execution primitive of the VM. It performs validation,
     * optional stage execution, normalization, and phase-aware dispatch — but
     * does NOT schedule, finalize, or emit hooks.
     *
     * Execution pipeline
     * ------------------
     * 1) Runtime grooming
     *    - Ensures required ticket runtime fields exist
     *      (cursor, phase, errorInfo).
     *
     * 2) Step validation
     *    - Resolves pipeline definition and current phase.
     *    - Resolves the current stage record and operation.
     *    - May produce:
     *        - `v.err`  → StageResult error
     *        - `v.done` → StageResult complete
     *        - executable stage metadata
     *
     *    Validation results are NOT early-returned; they flow through the
     *    same dispatch logic as normal stage execution.
     *
     * 3) Stage execution (when applicable)
     *    - Materializes arguments via `expr.materialize`.
     *    - Invokes the resolved stage function.
     *    - Catches thrown errors and converts them to `helpers.SR_error`.
     *    - Normalizes return value via `OP._normalizeReturn`.
     *
     * 4) Stage identity snapshot
     *    - Captures pre-mutation identity:
     *        { phase, stageIndex, pipelineKey, op, step }
     *    - Stamps stable metadata into `res.detail`.
     *
     * 5) Status dispatch
     *    - helpers.STAGE_STATUS.OK       → advance cursor
     *    - helpers.STAGE_STATUS.WAIT     → no cursor mutation
     *    - helpers.STAGE_STATUS.ERROR    → apply error-phase routing
     *    - helpers.STAGE_STATUS.COMPLETE → early completion result
     *    - Unknown                       → converted to SR_error
     *
     * Phase semantics
     * ---------------
     * - Phase is one of:
     *     helpers.PIPELINE_PHASE_RUN   ("run")
     *     helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * - When a stage fails:
     *     - If an error-phase pipeline exists, execution transitions into
     *       PIPELINE_PHASE_ERROR.
     *     - Otherwise, the error remains terminal.
     *
     * Return semantics
     * ----------------
     * - Always returns a normalized StageResult-like object.
     * - Never throws.
     * - Adds `return_status` property to the returned object.
     *   This reflects the raw status BEFORE any handler-induced transition
     *   (e.g., before entering PIPELINE_PHASE_ERROR).
     *
     * Mutations
     * ---------
     * This method may mutate:
     *   - ticket.cursor.stage
     *   - ticket.phase
     *   - ticket.errorInfo
     *
     * It does NOT:
     *   - finalize tickets
     *   - emit engine hooks
     *   - schedule other tickets
     *
     * @param {Object} args
     * @param {Object} args.job
     *   Job definition containing pipeline configuration.
     *
     * @param {Object} args.ticket
     *   Active ticket being executed.
     *
     * @param {Object} args.ctx
     *   Execution context passed through to the stage function.
     *
     * @returns {Promise<Object>}
     *   A normalized StageResult-like object with:
     *     - `status`  (helpers.STAGE_STATUS.*)
     *     - `detail`  (augmented stage metadata)
     *     - optional `error`
     *     - `return_status` (raw pre-transition status)
     */
    async step({ job, ticket, ctx }) {
	const lib = this.lib;
	this.validator._ensureTicketRuntime(ticket);

	const v = this.validator._validateStep({ job, ticket });

	const tagNoStage = (sr) => {
	    if (!sr || typeof sr !== "object") return sr;
	    if (!sr.detail || typeof sr.detail !== "object") sr.detail = {};
	    sr.detail.noStage = true;
	    return sr;
	};

	// always compute trigger + snapshot (even for validate errors)
	const trigger =
	      lib.hash.get(ticket, "inputs.trigger") ||
	      lib.hash.get(job, "e") ||
	      null;

	const snapShot = this._snapShot({ v, ticket });

	let res;

	// ------------------------------------------------------------
	// 1) Validate-time outcomes become normal "res" values
	//    (NO early returns; must flow through handler dispatch)
	// ------------------------------------------------------------
	if (v.err) {
	    res = tagNoStage(v.err);
	} else if (v.done) {
	    res = tagNoStage(v.res || v.err);
	} else {
	    // ------------------------------------------------------------
	    // 2) Normal stage execution
	    // ------------------------------------------------------------
	    try {
		const args = this.expr.materialize({ticket,job},v.args);
		res = await v.fn({
		    job,
		    lib,
		    args: args,
		    buffer : ticket.buffer,
		    inputs: ticket.inputs,
		    trigger,
		    ticket,
		    ctx,
		    step: v.stepRec,
		});
	    } catch (err) {
		res = helpers.SR_error(err, { pipelineKey: v.pipelineKey, op: v.op, step: v.stepRec });
	    }

	    // normalize only for real op execution
	    res = this.op._normalizeReturn(res, { pipelineKey: v.pipelineKey, op: v.op });
	}

	if (!res || typeof res !== "object") {
	    return helpers.SR_error(new Error("VM produced non-object StageResult"), { pipelineKey: snapShot.pipelineKey });
	}
	
	// raw status MUST be captured BEFORE any handler transforms it (enter PIPELINE_PHASE_ERROR, etc.)
	const return_status = res.status ?? null;

	// finalizeResponse can attach stage metadata, etc. (keep as you have it)
	res = this._finalizeResponse(res, snapShot);

	const env = { job, ticket, ctx, v, res, return_status };

	const disp = {
	    [helpers.STAGE_STATUS.OK]:       this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]:     this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]:    this._responseError,   // <- critical: now runs for v.err too
	    [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
	};

	const handler = disp[res?.status] || this._responseUnknown;
	const rv = handler.call(this, env);

	// preserve your rule: return_status is raw, unmodified by handler transitions
	rv.return_status = return_status;

	return rv;
    }
    
    /**
     * Handle an OK stage result.
     *
     * Advances the ticket cursor to the next stage within the
     * current pipeline phase and returns the original StageResult.
     *
     * Mutates:
     * - ticket.cursor.stage
     *
     * @param {Object} env
     * @param {Object} env.ticket
     * @param {Object} env.res
     * @returns {Object} StageResult
     */
    _responseOk({ ticket, res }) {
	ticket.cursor.stage += 1;
	return res;
    }

    /**
     * Handle a WAIT stage result.
     *
     * Leaves ticket execution state unchanged. The ticket remains
     * at the current stage and will be resumed by the scheduler.
     *
     * @param {Object} env
     * @param {Object} env.res
     * @returns {Object} StageResult
     */
    _responseWait({ res }) {
	return res;
    }

    /**
     * Handle a COMPLETE stage result.
     *
     * Produces a normalized early-completion StageResult.
     * Does not advance the cursor. Finalization and lifecycle
     * handling are performed by Tick.
     *
     * @param {Object} env
     * @param {Object} env.v
     *   Validated execution context for the current stage.
     *
     * @returns {Object} StageResult (helpers.SR_complete)
     */
    _responseComplete({ v }) {
	return helpers.SR_complete({ pipelineKey: v.pipelineKey, op: v.op, early: true });
    }


    /**
     * Handle a stage failure and apply error-phase routing semantics.
     *
     * This method determines whether a failing stage:
     *   1) Transitions execution into helpers.PIPELINE_PHASE_ERROR, or
     *   2) Remains a terminal error.
     *
     * Behavior
     * --------
     * 1) If the ticket is already in helpers.PIPELINE_PHASE_ERROR:
     *    - The error handler itself has failed.
     *    - A terminal helpers.SR_error is returned.
     *    - The original error context is preserved and annotated
     *      (`onErrorFailed`, `onErrorOp`, `onErrorStep`).
     *
     * 2) If the ticket is NOT in helpers.PIPELINE_PHASE_ERROR and the pipeline
     *    defines an error-phase track:
     *    - ticket.errorInfo is populated with the original failure context.
     *    - ticket.phase is set to helpers.PIPELINE_PHASE_ERROR.
     *    - ticket.cursor.stage is reset to 0.
     *    - An helpers.SR_ok result is returned to signal transition
     *      into the error phase.
     *
     * 3) If no error-phase pipeline exists:
     *    - The original StageResult is returned unchanged.
     *    - Tick will treat it as a terminal error.
     *
     * Mutations
     * ---------
     * When transitioning into helpers.PIPELINE_PHASE_ERROR,
     * this method mutates:
     *   - ticket.phase
     *   - ticket.cursor.stage
     *   - ticket.errorInfo
     *
     * It does NOT:
     *   - finalize tickets
     *   - emit hooks
     *   - schedule execution
     *
     * @param {Object} env
     * @param {Object} env.ticket
     *   Active ticket whose execution state is being evaluated.
     * @param {Object} env.v
     *   Validated execution context for the current stage
     *   (pipelineKey, pipelineDef, op, stepRec, etc.).
     * @param {Object} env.res
     *   Normalized StageResult representing the stage failure.
     *
     * @returns {Object}
     *   A StageResult:
     *     - helpers.SR_ok(...)    when entering helpers.PIPELINE_PHASE_ERROR
     *     - helpers.SR_error(...) when the error is terminal
     *     - or the original `res` if no error handler exists
     */
    _responseError({ ticket, v, res }) {

	// If the error handler itself fails (we are already in PIPELINE_PHASE_ERROR),
	// do NOT re-enter PIPELINE_PHASE_ERROR. Surface handler failure and preserve original.
	if (ticket.phase === helpers.PIPELINE_PHASE_ERROR) {
	    const detail = this.lib.hash.to(res.detail);

	    if (!detail.original) 
		detail.original = ticket.errorInfo || null;

	    detail.onErrorFailed = true;
	    detail.onErrorOp = v.op;
	    detail.onErrorStep = v.stepRec;

	    return helpers.SR_error(res.error, detail);
	}

	//array len checks arbitrary vals. no need to use defensively.
	//console.warn(v);
	
	const hasOnError = v.pipelineDef && this.lib.array.len(v.pipelineDef[helpers.PIPELINE_PHASE_ERROR]) > 0;
	if (hasOnError) {
            const from = {
		pipelineKey: v.pipelineKey,
		phase: ticket.phase,
		stageIndex: ticket.cursor?.stage ?? 0,
		op: v.op,
		opLabel: this.op._opLabel(v.op),
		step: v.stepRec,
            };

            ticket.errorInfo = {
		error: res.error || new Error("Stage error"),
		detail: res.detail || null,
		...from,
            };

            ticket.phase = helpers.PIPELINE_PHASE_ERROR;
            ticket.cursor.stage = 0;

            return helpers.SR_ok({
		pipelineKey: v.pipelineKey,
		reason: `enter ${helpers.PIPELINE_PHASE_ERROR}`,
		from,
		original: ticket.errorInfo || null,
            });
	}

	return res;
    }

    /**
     * Handle an unexpected or unsupported stage status.
     *
     * This is a defensive fallback invoked when `res.status`
     * does not match any known helpers.STAGE_STATUS value.
     *
     * Produces a terminal helpers.SR_error to prevent silent
     * continuation under undefined execution semantics.
     *
     * Does not mutate ticket state.
     *
     * @param {Object} env
     * @param {Object} env.v
     *   Validated execution context (pipelineKey, op, etc.).
     * @param {Object} env.res
     *   StageResult-like object with an unknown or missing status.
     *
     * @returns {Object}
     *   helpers.SR_error describing the invalid status.
     */
    _responseUnknown({ v, res }) {
	return helpers.SR_error(new Error(`Unknown stage status '${res?.status}'`), {
	    pipelineKey: v?.pipelineKey,
	    op: v?.op,
	});
    }

    /**
     * Capture stable stage identity BEFORE execution mutates ticket state.
     *
     * This snapshot preserves the execution context at the moment
     * the stage begins, prior to any handler-induced mutations
     * (e.g., transitioning from helpers.PIPELINE_PHASE_RUN to
     * helpers.PIPELINE_PHASE_ERROR).
     *
     * The returned object is later stamped into `res.detail`
     * to ensure trace/log metadata reflects the original
     * execution identity, not post-transition state.
     *
     * Does not mutate ticket.
     *
     * @param {Object} args
     * @param {Object} args.ticket
     *   Active ticket being executed.
     * @param {Object} args.v
     *   Validated execution context for the current stage.
     *
     * @returns {Object}
     *   Snapshot descriptor:
     *   {
     *     phase,
     *     stageIndex,
     *     pipelineKey,
     *     op,
     *     opLabel,
     *     step
     *   }
     */
    _snapShot({ticket,v}){
	const exec = {
	    phase: ticket.phase,                 // helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
	    stageIndex: ticket.cursor?.stage ?? 0,
	    pipelineKey: v.pipelineKey,
	    op: v.op,                            // may be string, function, etc
	    opLabel: this.op._opLabel(v.op),
	    step: v.stepRec,                     // raw step record (string/object)
	};
	return exec;
    }

    /**
     * Stamp stable stage metadata into a StageResult.
     *
     * This method injects the pre-execution snapshot identity
     * (captured by `_snapShot`) into `res.detail` to ensure that
     * trace and hook consumers see the original stage context,
     * even if ticket state has since mutated (e.g., phase change).
     *
     * Specifically attaches:
     *   - phase
     *   - stageIndex
     *   - pipelineKey
     *   - op (raw)
     *   - opLabel (safe string label)
     *   - step (raw stage record)
     *
     * Mutates:
     *   - res.detail (ensures it exists and stamps fields)
     *
     * Does NOT:
     *   - alter `res.status`
     *   - modify ticket state
     *   - perform lifecycle transitions
     *
     * @param {Object} res
     *   Normalized StageResult returned from execution or validation.
     *
     * @param {Object} snapShot
     *   Stage identity descriptor produced by `_snapShot`.
     *
     * @returns {Object}
     *   The same StageResult instance with augmented `detail`.
     */
    _finalizeResponse(res,snapShot){

	// $CLEANING Stamp stable stage identity into the result for hooks/logging.
	if (!res.detail || typeof res.detail !== "object") res.detail = {};
	res.detail.phase = snapShot.phase;
	res.detail.stageIndex = snapShot.stageIndex;
	res.detail.pipelineKey = snapShot.pipelineKey;
	
	// Preserve the original op value AND a label.
	res.detail.op = snapShot.op;               // raw
	res.detail.opLabel = snapShot.opLabel;     // safe string label
	// Keep the raw step too (super useful for debugging DSL strings)
	res.detail.step = snapShot.step;
	// END CLEANING
	return res;
    }
}

export default VM;

/**
 * NOTE: The structure below describes TickResponse payloads (Tick layer),
 * not VM return values.
 */

/**
   {
   // identity
   jobId,
   ticketId,
   pipelineKey,

   // execution context (if a stage was involved)
   stage: {
   phase,        // "run" | "PIPELINE_PHASE_ERROR"
   stageIndex,   // number | null
   op,           // raw op (string | fn | object | null)
   opLabel,      // string (always safe)
   step,         // raw step record (debug)
   } | null,

   // result of the step / transition
   result: {
   status,       // "ok" | "wait" | "error" | "complete"
   detail,       // StageResult.detail (augmented)
   error,        // Error | null
   },

   // terminal summary (ONLY when terminal === true)
   summary: {
   state,        // "complete" | "error"
   handled,      // boolean
   phase,        // terminal phase
   originalError,// snapshot | null
   } | null,

   // control flags
   didWork,        // boolean (engine did something)
   terminal,       // boolean (ticket ended)
   }
*/


# --- end: class/engine/vm/VM.js ---



# --- begin: class/event/Controller.js ---

/**
 * Event Controller
 * ----------------
 *
 * Manages delegated DOM event to pipeline bindings for ActiveTags Jobs.
 * Runtime bindings are installed through the injected EventDelegator service.
 *
 * This controller separates three distinct concerns:
 *
 *   Registration   discovery of event definitions from Job schema
 *   Enable state   logical permission for an event binding to be installed
 *   Runtime state  whether a delegated handler is currently installed
 *
 *
 * REGISTRATION
 * ------------
 * register() and registerAll() read event definitions from Job configuration
 * and populate the internal registry.
 *
 * Registration does not install delegated handlers.
 * Registration does not enqueue pipelines.
 * Registration does not execute pipelines.
 *
 *
 * ENABLE STATE
 * ------------
 * An event binding may be enabled or disabled.
 *
 * Enabled means the binding may be installed when on() is called.
 * Disabled bindings will not be installed and will be uninstalled if running.
 *
 * Calling disable() guarantees the binding is not installed.
 *
 *
 * RUNTIME STATE
 * -------------
 * on() installs eligible enabled delegated handlers.
 * off() uninstalls delegated handlers.
 *
 * Enabled does not imply installed.
 * Installed requires an explicit call to on().
 *
 *
 * REMOVAL
 * -------
 * remove(job) uninstalls all installed handlers for the Job and removes
 * its event definitions from the registry.
 *
 *
 * IDEMPOTENCY
 * -----------
 * registerAll() may be called multiple times.
 * It updates registry definitions but does not automatically reinstall
 * delegated handlers.
 *
 *
 * SEMANTIC NORMALIZATION
 * ----------------------
 * Event types may require normalization for delegated handling.
 * normalizeEventType() converts configured types into delegator-safe types.
 *
 * Some events require semantic filtering to avoid internal transitions
 * triggering pipelines.
 * setupEventHandler() routes special semantic cases through
 * SPECIAL_EVENT_HANDLERS so _onOne remains generic.
 *
 *
 * EXECUTION BOUNDARY
 * ------------------
 * This controller installs and removes delegated handlers only.
 *
 * Event delegation is provided by the injected delegator service.
 * Pipeline execution is delegated to the Engine.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * The controller must not execute pipelines directly.
 * The controller must not mutate Job configuration.
 * The controller must not implement scheduling or retry logic.
 *///use named import, default isnt iterable and doesnt play nice.
import { SPECIAL_EVENT_HANDLERS } from './specialHandlers.js';
import { normalizeEventType } from './typeNormalizers.js';

export class Controller {
    /**
     * Create a new Event Controller.
     *
     * CONTRACT
     * --------
     * The Event Controller requires a fully initialized ActiveTags instance and
     * its core runtime dependencies. It must be constructed only after:
     *   AT.engine exists
     *   AT.svc.delegator exists
     *
     * Construction performs validation and reference caching only.
     * No delegated handlers are installed.
     * No pipelines are enqueued or executed.
     *
     *
     * REQUIRED DEPENDENCIES
     * ---------------------
     * @param {Object} opts
     *
     * @param {ActiveTags} opts.AT
     *   The owning ActiveTags instance.
     *   Must expose:
     *     engine
     *     svc.delegator
     *
     * @param {Object} opts.lib
     *   The m7 lib instance used for normalization and internal utilities.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     * @param {string|Array<string>} opts.selector
     *   Root delegation selector used by the EventDelegator service.
     *   This value is required and must resolve to at least one non-empty string.
     *   If an array is provided, it is normalized and joined with a comma.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Normalizes selector input into a single delegation selector string.
     * Caches stable references to AT, engine, delegator, lib, and toJob.
     * Initializes an empty event registry keyed by jobId and eventName.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if AT.engine is missing.
     * Throws if AT.svc.delegator is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     * Throws if selector is missing or normalizes to an empty string.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register event definitions.
     * Does not install delegated handlers.
     * Does not enqueue or execute pipelines.
     */
    constructor({ AT, lib, toJob, selector } = {}) {
	if (!AT) throw new Error("EventController requires { AT }");
	if (!AT.engine) throw new Error("EventController requires AT.engine");
	if (!AT.svc || !AT.svc.delegator) throw new Error("EventController requires AT.svc.delegator");
	if (!lib) throw new Error("EventController requires { lib }");
	if (typeof toJob !== "function") throw new Error("EventController requires { toJob } function");

	// REQUIRED: root delegation selector (no default)
	let selectors = lib.array.to(selector);
	selectors = lib.array.filterStrings(selectors); // trims + removes non-strings

	const rootSelector = selectors.join(", ");
	if (!rootSelector) {
	    throw new Error("EventController requires { selector } (root delegation selector)");
	}

	this.selector = rootSelector;
	
	//selector = lib.str.to(selector, true).trim();
	//if (!selector) throw new Error("EventController requires { selector } (root delegation selector)");
	//this.selector  = selector;
	
	this.AT        = AT;
	this.engine    = AT.engine;
	this.delegator = AT.svc.delegator;
	this.lib       = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// jobId -> Map(eventName -> state)
	this.registry = new Map();

	Object.freeze(this);
    }

    /**
     * Destroy the Event Controller.
     *
     * CONTRACT
     * --------
     * destroy() uninstalls all delegated event handlers managed by this
     * controller and clears the internal registry.
     *
     * After destroy() completes:
     *   No delegated handlers installed by this controller will remain active.
     *   The internal event registry will be empty.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls off() with no arguments to uninstall all active handlers.
     * 2. Clears all registry entries.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Removes delegated handlers through the injected delegator service.
     * Discards all stored event definitions in the controller registry.
     *
     *
     * POSTCONDITION
     * -------------
     * The controller remains instantiated but contains no registered
     * or active event bindings.
     * Further calls to on() will have no effect until events are re-registered.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected delegator service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    destroy() {
        this.off(); // uninstall everything (runtime)
        this.registry.clear();
    }

    /**
     * Register event definitions for all eligible Jobs.
     *
     * CONTRACT
     * --------
     * registerAll() scans the JobRegistry and registers event definitions
     * for each eligible Job.
     *
     * It does not install delegated handlers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     *
     * ELIGIBILITY RULES
     * -----------------
     * A Job is processed only if:
     *   job exists
     *   job.config.schema.enable.enabled is true
     *
     * Jobs failing eligibility are skipped.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Retrieves all Jobs from AT.jobs.list().
     * 2. Filters out disabled Jobs.
     * 3. Calls register(job) for each eligible Job.
     * 4. Returns the number of Jobs processed.
     *
     *
     * IDEMPOTENCY
     * -----------
     * May be called multiple times.
     * Re-registering a Job refreshes its event definitions in the registry.
     * Existing installed handlers are not automatically reinstalled.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of Jobs for which register(job) was invoked.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Populates or updates entries in the internal event registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not uninstall existing handlers.
     * Does not mutate Job configuration.
     */
    
    registerAll() {
        const lib = this.lib;
        const AT = this.AT;

        const jobs = AT.jobs.list();
        if (!lib.array.len(jobs)) return 0;

        let count = 0;

        for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            this.register(job);
            count++;
        }

        return count;
    }

    /**
     * Register event definitions for a single Job.
     *
     * CONTRACT
     * --------
     * register() reads event definitions from a Job configuration block and
     * stores normalized event entries in the internal registry.
     *
     * It does not install delegated handlers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     * This is a Job-scoped registry operation.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * SOURCE CONFIG
     * -------------
     * Event definitions are read from:
     *   job.config.schema.events
     *
     * The events block is expected to be an object whose keys are event binding names.
     *
     *
     * NORMALIZATION RULES
     * -------------------
     * For each event record:
     *   enabled defaults to true unless explicitly disabled
     *   event must be a non-empty string and is normalized to lowercase
     *   pipeline must be a non-empty string
     *
     * Records that fail structural requirements are skipped.
     *
     * Disabled bindings are still registered so they may be enabled later.
     *
     *
     * REGISTRY EFFECT
     * ---------------
     * Registry layout is:
     *   registry.get(jobId) returns Map(bindingName -> entry)
     *
     * Each entry contains:
     *   jobId
     *   name
     *   enabled
     *   on
     *   def
     *   runtimeTag
     *   offFn
     *
     * Re-registering replaces the stored entry definition and resets on to false.
     * This method does not uninstall or reinstall any active delegated handlers.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of event entries added or replaced for the Job.
     *
     *
     * FAILURE MODES
     * -------------
     * Returns 0 if jobLike cannot be resolved to a Job with an id.
     * Returns 0 if the events block is missing or not an object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Creates or updates registry entries for the resolved Job id.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not install delegated handlers.
     * Does not mutate Job configuration.
     */
    register(jobLike) {
        const lib = this.lib;

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const events = lib.hash.get(job, "config.schema.events");
        if (!lib.hash.is(events)) return 0;

        let jobEntry = this.registry.get(job.id);
        if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
        }

        let count = 0;

        for (const name in events) {
            const rec = lib.hash.get(events, name);
            if (!rec) continue;

            // keep disabled too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity: must have event type + pipeline
            const eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!eventType || !pipeline) continue;

            jobEntry.set(name, {
                jobId: job.id,
                name,
                enabled,
                on: false,
                def: rec,

                // runtime (filled by on/off)
                runtimeTag: null,
                offFn: null,
            });

            count++;
        }

        return count;
    }

    /**
     * Remove all event definitions for a single Job.
     *
     * CONTRACT
     * --------
     * remove() uninstalls all delegated event handlers for the resolved Job
     * and removes its event definitions from the internal registry.
     *
     * Removal implies off.
     * After removal, no event binding for the Job will remain registered
     * or installed under this controller.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. If no registry entry exists for the Job, returns 0.
     * 3. Calls off(job) to uninstall any active delegated handlers.
     * 4. Deletes the Job entry from the registry.
     * 5. Returns the number of event definitions removed.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of event entries removed for the Job.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Uninstalls delegated handlers through the injected delegator service.
     * Removes all stored event definitions for the Job.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected delegator service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    remove(jobLike) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const count = jobEntry.size;

        // runtime: uninstall any active handlers first
        this.off(job);

        // registry: remove entire job entry
        this.registry.delete(job.id);

        return count;
    }

    /**
     * List event binding state for a single Job.
     *
     * CONTRACT
     * --------
     * listJob() returns a snapshot of the logical and runtime state
     * of all event bindings registered for a resolved Job.
     *
     * It does not mutate registry state.
     * It does not install or uninstall delegated handlers.
     * It does not access the delegator service.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. Retrieves the Job's event registry entry.
     * 3. Builds and returns a plain object describing event binding state.
     *
     * Each event entry includes:
     *   enabled  logical enable state
     *   on       current runtime installation state
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   A plain object keyed by event binding name.
     *   Each value contains:
     *     enabled boolean
     *     on      boolean
     *
     *   Returns an empty object if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not expose internal event definitions.
     * Does not expose runtime tags or off functions.
     * Does not validate registry integrity.
     */
    listJob(jobLike) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return {};

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return {};

        const out = {};
        for (const [name, entry] of jobEntry.entries()) {
            out[name] = { enabled: !!entry.enabled, on: !!entry.on };
        }
        return out;
    }

    /**
     * List Jobs that have registered event bindings.
     *
     * CONTRACT
     * --------
     * listJobs() returns identifiers for all Jobs currently present
     * in the event registry.
     *
     * It reflects registry membership only.
     * It does not indicate whether bindings are enabled or installed.
     * It does not mutate controller state.
     *
     *
     * INPUT
     * -----
     * @param {boolean} [name=true]
     *   If true, returns Job names when available.
     *   If false, returns Job ids.
     *
     *
     * BEHAVIOR
     * --------
     * Iterates over all Job ids stored in the event registry.
     *
     * If name is false:
     *   Returns the Job id for each entry.
     *
     * If name is true:
     *   Attempts to resolve the Job and return:
     *     job.name if present
     *     otherwise job.config.schema.name if present
     *     otherwise the Job id
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   An array of Job identifiers.
     *   Each entry corresponds to a Job that has at least one
     *   registered event definition.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate Job existence beyond toJob resolution.
     * Does not expose event configuration details.
     * Does not indicate runtime installation state.
     */
    listJobs(name = true) {
        const lib = this.lib;
        const out = [];

        for (const jobId of this.registry.keys()) {
            if (!name) {
                out.push(jobId);
                continue;
            }

            const job = this.toJob(jobId);
            const jobName =
                  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
                  null;

            out.push(jobName || jobId);
        }

        return out;
    }

    /**
     * Logically enable event bindings for a Job.
     *
     * CONTRACT
     * --------
     * enable() marks event bindings as eligible to be installed.
     *
     * It does not install delegated handlers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     * An enabled event binding will only be installed if on() is called.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [eventName]
     *   Optional event binding name.
     *   If omitted or falsy, all event bindings for the Job are enabled.
     *   If provided, only the specified binding is enabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its event registry entry.
     *
     * If eventName is omitted:
     *   Sets enabled to true for all event entries of the Job.
     *
     * If eventName is provided:
     *   Sets enabled to true for the specified event entry.
     *
     * No delegated handlers are installed automatically.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one binding changed state.
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *     the specified event does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates the logical enable state in the internal registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate event bindings.
     * Does not uninstall handlers.
     * Does not mutate Job configuration.
     */
    enable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // enable ALL events for this job
        if (!eventName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
                if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
                }
            }
            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        entry.enabled = true;
        return true;
    }

    /**
     * Logically disable event bindings for a Job.
     *
     * CONTRACT
     * --------
     * disable() marks event bindings as ineligible to be installed.
     *
     * Disabling implies off.
     * If a targeted binding is currently installed, it will be uninstalled.
     *
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [eventName]
     *   Optional event binding name.
     *   If omitted or falsy, all event bindings for the Job are disabled.
     *   If provided, only the specified binding is disabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its event registry entry.
     *
     * If eventName is omitted:
     *   For each event entry:
     *     Uninstalls the handler if it is installed.
     *     Sets enabled to false.
     *
     * If eventName is provided:
     *   Uninstalls the handler if it is installed.
     *   Sets enabled to false.
     *
     * Runtime uninstallation is performed via the internal _offOne() helper.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one binding changed state.
     *   A change includes enabled changing from true to false.
     *
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered events
     *     the specified event does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * May uninstall delegated handlers through the injected delegator service.
     * Mutates the logical enable state in the internal registry.
     * Updates runtime state for uninstalled bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove event definitions from the registry.
     * Does not mutate Job configuration.
     * Does not validate pipeline existence.
     */
    disable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // disable ALL events for this job
        if (!eventName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
                if (entry.on) this._offOne(job, name);

                if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
                }
            }

            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        if (entry.on) this._offOne(job, eventName);

        const wasEnabled = !!entry.enabled;
        entry.enabled = false;
        return wasEnabled;
    }

    /**
     * Install delegated event handlers for registered event bindings.
     *
     * CONTRACT
     * --------
     * on() installs delegated handlers for enabled event bindings.
     *
     * It does not execute pipelines directly.
     * It installs handlers through the injected delegator service.
     * Pipeline execution is delegated to the Engine when events fire.
     *
     * Disabled bindings are never installed.
     * Bindings that are already installed are not duplicated.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, on() applies globally to all Jobs in the registry.
     *
     * @param {string} [eventName]
     *   Optional event binding name selector.
     *   If provided and non-empty, only that binding name is targeted.
     *   If omitted or empty, all bindings for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to install bindings for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its event map from the registry.
     *
     * Binding selection
     *   If eventName is provided, attempts to install that single binding.
     *   Otherwise attempts to install all registered bindings for the Job.
     *
     * Installation is delegated to the internal _onOne(job, name) helper.
     * _onOne is responsible for enforcing enable state and preventing duplicates.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of delegated handlers successfully installed.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May install delegated handlers through the injected delegator service.
     * May update registry runtime state for installed bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not change enable state.
     * Does not validate pipeline existence.
     * Does not enqueue pipelines directly.
     */
    on(jobLike, eventName) {
	const lib = this.lib;

	// GLOBAL: turn on all events for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, eventName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single event
	if (lib.str.to(eventName, true).trim()) {
            return this._onOne(job, eventName);
	}

	// all events for this job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _onOne() is the internal installation primitive for a single event binding.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use on() and off().
     *
     *
     * CONTRACT
     * --------
     * _onOne() attempts to install exactly one delegated handler for a Job and
     * event binding name.
     *
     * It enforces all installation gates:
     *   Job must resolve and have an id
     *   eventName must be a non-empty string
     *   event entry must exist in the registry
     *   entry.enabled must be true
     *   entry.on must be false
     *   rec.event must normalize to a non-empty eventType
     *   rec.pipeline must be a non-empty string
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * TYPE NORMALIZATION
     * ------------------
     * The configured event type is normalized to lowercase and passed through
     * normalizeEventType() to produce a delegator-safe eventType.
     *
     *
     * SEMANTIC HANDLERS
     * -----------------
     * setupEventHandler() is used as an explicit semantic normalization step.
     * It may return a wrapper handler for special event types while keeping
     * delegation installation generic.
     *
     *
     * RUNTIME TAGGING
     * --------------
     * A stable runtime tag is computed as:
     *   at:event:jobId:eventName
     *
     * This tag is passed to the delegator and stored in the registry entry.
     * The tag enables teardown by tag-based removal and supports debugging.
     *
     *
     * DELEGATOR CONTRACT
     * ------------------
     * This method assumes the injected delegator service provides:
     *   on({ eventType, selector, options, policy, tag, handler }) -> offFn
     *
     * offFn must uninstall the delegated handler installed by this call.
     *
     *
     * EXECUTION BOUNDARY
     * ------------------
     * The delegated handler must not execute pipelines directly.
     * It must enqueue into the Engine and delegate execution to Engine drain.
     *
     * That behavior is implemented by setupEventHandler() and any special handlers.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Installs a delegated handler through the injected delegator service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to true
     *   entry.runtimeTag is set to the stable runtime tag
     *   entry.offFn is set to the delegator uninstall function
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not create duplicate handlers for the same binding.
     * This method must not mutate Job configuration.
     * This method must remain gate-driven and deterministic.
     */
    _onOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // logical gate
        if (lib.bool.no(entry.enabled)) return 0;

        // already on
        if (lib.bool.yes(entry.on)) return 0;

        const rec = entry.def || {};

        let eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
	eventType = normalizeEventType(eventType);
        const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
        if (!eventType || !pipeline) return 0;

        const options = lib.hash.to(lib.hash.get(rec, "options"));
        const policy = lib.hash.to(lib.hash.get(rec, "policy")) || { match: "closest" };

        // TEMP (portable): anchor delegation to ActiveTags elements.
        // Later: job-scoped selectors/subselectors.
        const selector = this.selector;

        // tag enables teardown via offTag() without needing handler refs
        const runtimeTag = `at:event:${job.id}:${eventName}`;

        const handler = this.setupEventHandler({
            job,
            eventName,
            eventType,
            pipeline,
            rec,
        });

        // install delegated handler
        const offFn = this.delegator.on({
            eventType,
            selector,
            options,
            policy,
            tag: runtimeTag,
            handler,
        });

        // mark runtime state
        entry.on = true;
        entry.runtimeTag = runtimeTag;
        entry.offFn = offFn;

        return 1;
    }



    /**
     * Build a delegator-compatible handler for a single event binding.
     *
     * CONTRACT
     * --------
     * setupEventHandler() returns a function intended to be installed by the
     * EventDelegator service. The delegator calls this handler with:
     *   this bound to the matched ActiveTags root element
     *   the DOM Event object as the first argument
     *
     * The returned handler enqueues the configured pipeline into the Engine
     * when the binding is triggered, then schedules a scoped drain.
     *
     * It does not execute pipelines directly.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Job} args.job
     *   The owning Job for this binding.
     *   The handler enforces that the matched element belongs to this Job.
     *
     * @param {string} args.eventName
     *   The event binding name as stored in the controller registry.
     *
     * @param {string} args.eventType
     *   The normalized delegator-safe event type for installation and metadata.
     *
     * @param {string} args.pipeline
     *   The pipeline key to enqueue when the event fires.
     *
     * @param {Object} args.rec
     *   The original event record from Job schema.
     *   May include selector for sub-delegation filtering.
     *
     *
     * SUB-DELEGATION
     * --------------
     * If rec.selector is provided, it is treated as a trigger filter.
     *
     * In that case:
     *   The handler requires the event target to be within the Job root element.
     *   The handler requires the event target to have a closest match to rec.selector.
     *   The semantic trigger becomes the matched sub-element rather than the Job root.
     *
     *
     * SPECIAL EVENT ROUTING
     * ---------------------
     * Before normal enqueue behavior, the handler calls:
     *   _handleSpecialEvent({ el, e, eventType, subSelector })
     *
     * If that function returns true, the event is considered consumed and the
     * normal enqueue path is skipped.
     *
     * This keeps semantic edge cases out of the main enqueue path.
     *
     *
     * ENGINE ENQUEUE
     * --------------
     * On a normal trigger, the handler enqueues:
     *   engine.enqueue(job, pipeline, { inputs, meta })
     *
     * inputs include:
     *   reason     "event"
     *   eventName  binding name
     *   event      the DOM event object
     *   trigger    Job root element or matched sub-element
     *
     * meta includes:
     *   source       "delegator"
     *   eventType    normalized event type
     *   eventName    binding name
     *   subSelector  selector string or null
     *
     * Drain is scheduled asynchronously to avoid reentrancy and allow coalescing:
     *   Promise.resolve().then(() => AT.engine.drain({ ticket, ctx: {} }))
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Function}
     *   A delegator-compatible handler function.
     *
     *
     * SIDE EFFECTS
     * ------------
     * When invoked by the delegator, may enqueue a ticket and schedule a drain.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate pipeline existence.
     * Does not mutate Job configuration.
     * Does not install or uninstall delegated handlers.
     * Installation and teardown are handled by _onOne() and _offOne().
     */
    setupEventHandler({ job, eventName, eventType, pipeline, rec } = {}) {
	const engine = this.engine;
	const AT = this.AT;
	const lib = this.lib;


	// optional sub-selector (trigger filter)
	const subSelector = lib.str.to(lib.hash.get(rec, "selector"), true).trim();

	// capture controller for helpers without touching handler `this`
	const self = this;

	return function handler(e) {
            const el = this; // matched ActiveTag element (delegator contract)
            let trigger = el; // default trigger is the ActiveTag root

            // ensure correct job ownership
            if (job.e && el !== job.e) return;

            // sub-delegation gate (applies to ALL events)
            if (subSelector) {
		const t = e && e.target;
		if (!t || !el.contains(t)) return;

		const hit = t.closest ? t.closest(subSelector) : null;
		if (!hit || !el.contains(hit)) return;

		// semantic trigger is the matched sub-element
		trigger = hit;
            }

            // ---- special-case routing (keeps main handler clean) ----
            if (self._handleSpecialEvent({ el, e, eventType, subSelector })) {
		return; // special case consumed it
            }

            // ---- normal behavior ----
            const ticket = engine.enqueue(job, pipeline, {
		inputs: {
                    reason: "event",
                    eventName,
                    event: e,
		    trigger
		},
		meta: {
                    source: "delegator",
                    eventType,
                    eventName,
                    subSelector: subSelector || null,
		},
            });

            // pass trigger through ctx for ops/runtime use
            Promise.resolve().then(() =>
		AT.engine.drain({ ticket, ctx: { } })
            );
	};
    }

    /**
     * Developer note
     * --------------
     * _handleSpecialEvent() routes event contexts through registered
     * special-case handlers.
     *
     * This method is intentionally private.
     * It exists to isolate semantic edge-case handling from the main
     * event enqueue path.
     *
     *
     * CONTRACT
     * --------
     * Iterates through SPECIAL_EVENT_HANDLERS and invokes each handler
     * with the provided context object.
     *
     * If any handler returns true, the event is considered consumed
     * and normal processing must stop.
     *
     * If no handler consumes the event, returns false.
     *
     *
     * INPUT
     * -----
     * @param {Object} ctx
     *   Context object passed through from setupEventHandler().
     *   Typically includes:
     *     el           matched ActiveTags root element
     *     e            DOM event object
     *     eventType    normalized event type
     *     subSelector  optional trigger selector
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if a special handler consumed the event
     *   false if normal processing should continue
     *
     *
     * SIDE EFFECTS
     * ------------
     * Depends on the behavior of registered special handlers.
     * This method itself does not enqueue pipelines or install handlers.
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * SPECIAL_EVENT_HANDLERS must be pure routing filters.
     * They must return true only when they have fully handled the event.
     * They must not mutate controller state.
     */
    _handleSpecialEvent(ctx) {
	for (const fn of SPECIAL_EVENT_HANDLERS) {
            if (fn(ctx)) return true;
	}
	return false;
    }
    
    
    /**
     * Uninstall delegated event handlers for registered event bindings.
     *
     * CONTRACT
     * --------
     * off() uninstalls delegated handlers previously installed by on().
     *
     * It does not execute pipelines.
     * It does not enqueue pipelines.
     * It does not modify enable state.
     *
     * Calling off() is safe even if the targeted binding is not installed.
     * Bindings that are not installed result in no action and contribute 0 to the count.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, off() applies globally to all Jobs in the registry.
     *
     * @param {string} [eventName]
     *   Optional event binding name selector.
     *   If provided and non-empty, only that binding name is targeted.
     *   If omitted or empty, all bindings for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to uninstall bindings for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its event map from the registry.
     *
     * Binding selection
     *   If eventName is provided, attempts to uninstall that single binding.
     *   Otherwise attempts to uninstall all registered bindings for the Job.
     *
     * Uninstallation is delegated to the internal _offOne(job, name) helper.
     * _offOne is responsible for invoking the uninstall function and updating state.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of delegated handlers successfully uninstalled.
     *   Returns 0 if the Job cannot be resolved or has no registered events.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May uninstall delegated handlers through the injected delegator service.
     * May update registry runtime state for uninstalled bindings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove event definitions from the registry.
     * Does not change enable state.
     * Does not validate pipeline existence.
     */
    off(jobLike, eventName) {
        const lib = this.lib;

        // global off(): uninstall everything currently installed
        if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
                const job = this.toJob(jobId);
                if (!job || !job.id) continue;
                count += this.off(job);
            }
            return count;
        }

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        if (lib.str.to(eventName, true).trim()) {
            return this._offOne(job, eventName);
        }

        let count = 0;
        for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
        }
        return count;
    }

    /**
     * Developer note
     * --------------
     * _offOne() is the internal uninstallation primitive for a single event binding.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use off(), disable(), or remove().
     *
     *
     * CONTRACT
     * --------
     * _offOne() attempts to uninstall exactly one delegated handler for a Job and
     * event binding name.
     *
     * It enforces all uninstallation gates:
     *   Job must resolve and have an id
     *   eventName must be a non-empty string
     *   event entry must exist in the registry
     *   entry.on must be true
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * TEARDOWN STRATEGY
     * -----------------
     * Teardown uses two mechanisms for safety:
     *
     * 1. Direct unsubscribe
     *    If entry.offFn is present, it is invoked to uninstall the handler.
     *
     * 2. Tag-based teardown
     *    If entry.runtimeTag is present, delegator.offTag(tag) is invoked as a
     *    defensive cleanup mechanism.
     *
     * Both may be used to tolerate partial state or delegator implementation changes.
     *
     *
     * DELEGATOR CONTRACT
     * ------------------
     * This method assumes the injected delegator service provides:
     *   offTag(tag)
     *
     * entry.offFn is expected to be the uninstall function returned by delegator.on().
     *
     *
     * SIDE EFFECTS
     * ------------
     * Uninstalls the delegated handler through the delegator service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to false
     *   entry.runtimeTag is cleared
     *   entry.offFn is cleared
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not alter enable state.
     * This method must not remove registry entries.
     * This method must not enqueue or execute pipelines.
     */
    _offOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // already off
        if (lib.bool.no(entry.on)) return 0;

        // teardown using the stored unsubscribe if present; also tag-teardown for safety
        if (typeof entry.offFn === "function") entry.offFn();
        if (entry.runtimeTag) this.delegator.offTag(entry.runtimeTag);

        entry.on = false;
        entry.runtimeTag = null;
        entry.offFn = null;

        return 1;
    }
}

export default Controller;


# --- end: class/event/Controller.js ---



# --- begin: class/event/specialHandlers.js ---

/**
 * Event Special Handlers
 * ----------------------
 *
 * Provides semantic filtering for delegated DOM events used by the
 * ActiveTags Event Controller.
 *
 * PURPOSE
 * -------
 * Some DOM events do not directly represent meaningful user intent.
 * Hover and focus related events may fire repeatedly during internal
 * DOM transitions, such as movement between child elements.
 *
 * This module centralizes semantic boundary rules so that:
 *   The Event Controller remains generic
 *   Pipeline dispatch logic remains clean
 *   Edge cases are isolated and testable
 *
 *
 * EXECUTION MODEL
 * ---------------
 * Each handler receives a context object containing:
 *   el           resolved ActiveTag root element
 *   e            DOM event object
 *   eventType    normalized delegator-safe event type
 *   subSelector  optional sub-delegation selector
 *
 * Handlers are evaluated sequentially.
 * The first handler that returns true is considered to have consumed
 * the event.
 *
 * Returning true means:
 *   The event should be ignored
 *   No pipeline should be enqueued
 *
 * Returning false means:
 *   Normal event processing should continue
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Handlers must be pure functions.
 * Handlers must not enqueue pipelines.
 * Handlers must not install or uninstall delegated handlers.
 * Handlers must not mutate controller or Job state.
 *
 * Job identity is already resolved upstream.
 * All logic operates relative to the provided root element.
 *
 *
 * SUB-DELEGATION
 * --------------
 * When a sub-selector is present, semantic boundary checks are evaluated
 * relative to the matched sub-target rather than the entire root element.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional semantic handlers may be appended to
 * SPECIAL_EVENT_HANDLERS.
 *
 * Ordering matters.
 * Earlier handlers have priority over later ones.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not normalize event types.
 * Does not perform event delegation.
 * Does not interact with the Engine.
 */

/**
 * Hover Semantic Handler
 * ----------------------
 *
 * Provides semantic boundary filtering for delegated hover events.
 *
 * CONTRACT
 * --------
 * Suppresses pointerover and pointerout events that represent internal
 * movement within the same semantic hover boundary.
 *
 * If the event represents a true boundary enter or leave, returns false.
 * If the event represents internal movement and should be ignored,
 * returns true.
 *
 *
 * APPLICABILITY
 * -------------
 * Only applies to:
 *   pointerover
 *   pointerout
 *
 * All other event types return false immediately.
 *
 *
 * INPUT
 * -----
 * @param {Object} ctx
 * @param {Element} ctx.el
 *   The resolved ActiveTag root element.
 *
 * @param {Event} ctx.e
 *   The DOM event object.
 *
 * @param {string} ctx.eventType
 *   Normalized event type string.
 *
 * @param {string|null} ctx.subSelector
 *   Optional sub-delegation selector used to narrow hover boundaries.
 *
 *
 * SEMANTIC RULES
 * --------------
 * Tag-level semantics
 *   Without subSelector, the boundary is the entire ActiveTag element.
 *   If relatedTarget is contained within el, the movement is internal
 *   and the event is suppressed.
 *
 * Sub-delegation semantics
 *   When subSelector is provided, boundaries are evaluated relative to
 *   the matched sub-target element.
 *
 *   The event is suppressed only if:
 *     Both the current target and relatedTarget resolve to the same
 *     sub-target within el.
 *
 *   Movement between different sub-targets or into or out of the
 *   ActiveTag boundary is allowed.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {boolean}
 *   true  if the event should be consumed and ignored
 *   false if normal processing should continue
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain pure.
 * Must not enqueue pipelines.
 * Must not mutate controller or Job state.
 */

export function handleHover({ el, e, eventType, subSelector }) {
    if (eventType !== "pointerover" && eventType !== "pointerout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    // no sub-selector: original tag-level hover semantics
    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = t  && t.closest ? t.closest(subSelector) : null;
    const rhit = rt && rt.closest ? rt.closest(subSelector) : null;

    const hitOk  = hit  && el.contains(hit);
    const rhitOk = rhit && el.contains(rhit);

    // ignore only if we stayed within the same sub-target
    return hitOk && rhitOk && hit === rhit;
}


/**
 * Focus Semantic Handler
 * ----------------------
 *
 * Provides semantic boundary filtering for delegated focus events.
 *
 * CONTRACT
 * --------
 * Suppresses focusin and focusout events that represent internal focus
 * transitions within the same semantic boundary.
 *
 * If the event represents a true boundary enter or leave, returns false.
 * If the event represents internal focus movement and should be ignored,
 * returns true.
 *
 *
 * APPLICABILITY
 * -------------
 * Only applies to:
 *   focusin
 *   focusout
 *
 * All other event types return false immediately.
 *
 * Event type normalization from focus and blur to focusin and focusout
 * must occur before this handler is invoked.
 * This handler does not perform event type normalization.
 *
 *
 * INPUT
 * -----
 * @param {Object} ctx
 * @param {Element} ctx.el
 *   The resolved ActiveTag root element.
 *
 * @param {Event} ctx.e
 *   The DOM event object.
 *
 * @param {string} ctx.eventType
 *   Normalized event type string.
 *
 * @param {string|null} ctx.subSelector
 *   Optional sub-delegation selector used to narrow focus boundaries.
 *
 *
 * SEMANTIC RULES
 * --------------
 * Tag-level semantics
 *   Without subSelector, the boundary is the entire ActiveTag element.
 *   If relatedTarget is contained within el, the focus shift is internal
 *   and the event is suppressed.
 *
 * Sub-delegation semantics
 *   When subSelector is provided, boundaries are evaluated relative to
 *   the matched sub-target element.
 *
 *   The event is suppressed only if:
 *     Both the current target and relatedTarget resolve to the same
 *     sub-target within el.
 *
 *   Focus movement between different sub-targets or into or out of the
 *   ActiveTag boundary is allowed.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {boolean}
 *   true  if the event should be consumed and ignored
 *   false if normal processing should continue
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain pure.
 * Must not enqueue pipelines.
 * Must not mutate controller or Job state.
 */
export function handleFocus({ el, e, eventType, subSelector }) {
    if (eventType !== "focusin" && eventType !== "focusout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = t  && t.closest ? t.closest(subSelector) : null;
    const rhit = rt && rt.closest ? rt.closest(subSelector) : null;

    const hitOk  = hit  && el.contains(hit);
    const rhitOk = rhit && el.contains(rhit);

    return hitOk && rhitOk && hit === rhit;
}


export const SPECIAL_EVENT_HANDLERS = [
    handleHover,
    handleFocus,
];

export default {
    handleHover, handleFocus
}



# --- end: class/event/specialHandlers.js ---



# --- begin: class/event/typeNormalizers.js ---

/**
 * Event Type Normalizers
 * ----------------------
 *
 * Provides pure normalization utilities that convert configured event type
 * strings into delegator-safe equivalents.
 *
 * PURPOSE
 * -------
 * Some DOM events do not delegate reliably in their native form.
 * For example, focus and blur do not bubble, while focusin and focusout do.
 *
 * This module centralizes event type normalization so the EventController
 * can remain generic and unaware of DOM bubbling edge cases.
 *
 *
 * EXECUTION PHASE
 * ---------------
 * Normalization occurs before delegated handler installation.
 * The normalized event type is what is passed to the EventDelegator.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Normalizers must be pure functions.
 * They must accept a string and return a string.
 * They must not mutate external state.
 * They must not access controller or runtime services.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional normalizers may be appended to EVENT_TYPE_NORMALIZERS.
 * normalizeEventType() applies each normalizer in sequence,
 * allowing composable transformation of event types.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not install handlers.
 * Does not filter events.
 * Does not enqueue pipelines.
 * Does not interact with the Engine or Delegator.
 */

/**
 * Normalize non-bubbling focus and blur events to bubbling equivalents.
 *
 * CONTRACT
 * --------
 * Converts:
 *   "focus" to "focusin"
 *   "blur"  to "focusout"
 *
 * All other event types are returned unchanged.
 *
 * This enables reliable delegation since focusin and focusout bubble,
 * while focus and blur do not.
 *
 *
 * INPUT
 * -----
 * @param {string} eventType
 *   Lowercase DOM event type string.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {string}
 *   A delegator-safe event type string.
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain a pure function.
 * Must not access external state.
 */
export function normalizeFocusBlur(eventType) {
    if (eventType === "focus") return "focusin";
    if (eventType === "blur")  return "focusout";
    return eventType;
}

/**
 * Ordered list of event type normalizer functions.
 *
 * CONTRACT
 * --------
 * Each entry must be a pure function with signature:
 *   fn(eventType: string) -> string
 *
 * Normalizers are applied in array order by normalizeEventType().
 * The output of one normalizer becomes the input to the next.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional normalizers may be appended to this array.
 * Ordering matters. Earlier normalizers may transform input
 * consumed by later ones.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Entries must not produce side effects.
 * Entries must not depend on controller or runtime state.
 * The array itself should be treated as configuration, not mutated at runtime.
 */

export const EVENT_TYPE_NORMALIZERS = [
    normalizeFocusBlur,
];


/**
 * Normalize a configured event type using registered normalizers.
 *
 * CONTRACT
 * --------
 * Applies each function in EVENT_TYPE_NORMALIZERS sequentially
 * to the provided eventType string.
 *
 * The output of one normalizer becomes the input of the next.
 *
 * The final transformed string is returned.
 *
 *
 * INPUT
 * -----
 * @param {string} eventType
 *   Lowercase DOM event type string.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {string}
 *   A normalized, delegator-safe event type.
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain pure.
 * Must not mutate EVENT_TYPE_NORMALIZERS.
 * Must not access runtime services.
 */
export function normalizeEventType(eventType) {
    for (const fn of EVENT_TYPE_NORMALIZERS) {
        eventType = fn(eventType);
    }
    return eventType;
}


# --- end: class/event/typeNormalizers.js ---



# --- begin: class/expressions/dispatch.js ---

// expr/dispatch.js
// Build the parseTarget dispatch table for ExpressionResolver.parse(ctx, target)
//
// Contract:
//  - returns an object map: type -> () => TargetRef|value|Element|undefined
//  - each handler closes over ctx + resolver + loc
//  - no fallback / magic coercion happens here (caller decides)

export default function buildDispatch(resolver, ctx, loc) {
    const lib = resolver.lib;

    // normalize ctx (defensive)
    ctx = lib.hash.to(ctx) || {};

    const job    = resolver._asJob ? resolver._asJob(ctx.job) : ctx.job;
    const ticket = ctx.ticket || null;

    // env (resolver already seeded these from m7-lib _env.root)
    const thisWindow   = lib.hash.get(ctx, "env.window")   || resolver.window;
    const thisDocument = lib.hash.get(ctx, "env.document") || resolver.document;

    // v1 runtime anchors
    const e      = lib.hash.get(job, "e");
    const tgt    = lib.hash.get(ticket, "target");
    const buffer = lib.hash.get(ticket, "buffer");

    // helpers
    const hasLoc = !(loc == null || loc === "");

    return {
        // ---------------------------------------------------------------------
        // Core sources
        // ---------------------------------------------------------------------
        job: () => {
            if (!job) return undefined;
            return hasLoc ? { src: job, prop: loc } : job;
        },

        ticket: () => {
            if (!ticket) return undefined;
            return hasLoc ? { src: ticket, prop: loc } : ticket;
        },

        config: () => {
            const schema = lib.hash.get(job, "config.schema");
            if (!schema) return undefined;
            return hasLoc ? { src: schema, prop: loc } : schema;
        },

        trans: () => {
            const tx = lib.hash.get(job, "transactions");
            if (!tx) return undefined;
            return hasLoc ? { src: tx, prop: loc } : tx;
        },

        ws: () => {
            const ws = lib.hash.get(job, "ws");
            if (!ws) return undefined;
            return { src: ws, prop: loc };
        },

        // ---------------------------------------------------------------------
        // Buffer (v1)
        // ---------------------------------------------------------------------
        buffer: () => {
            if (!buffer) return undefined;
            const v = buffer.get();
            return hasLoc ? { src: v, prop: loc } : v;
        },

        buffer_meta: () => {
            if (!buffer) return undefined;
            const m = buffer.meta();
            return hasLoc ? { src: m, prop: loc } : m;
        },

        // ---------------------------------------------------------------------
        // Environment
        // ---------------------------------------------------------------------
        window: () => {
            if (!thisWindow) return undefined;
            return { src: thisWindow, prop: loc };
        },

        // ---------------------------------------------------------------------
        // DOM anchors
        // ---------------------------------------------------------------------
        this: () => {
            if (!e) return undefined;
            return { src: e, prop: loc };
        },

        target: () => {
            if (!tgt) return undefined;
            return { src: tgt, prop: loc };
        },

        // ---------------------------------------------------------------------
        // DOM navigation helpers (return DOM element)
        // ---------------------------------------------------------------------
        doc: () => {
            if (!thisDocument) return undefined;
            try {
                const found = thisDocument.querySelector(loc);
                if (!found) resolver.warn && resolver.warn(`couldnt find element with document.querySelector('${loc}')`, ctx);
                return found;
            } catch (err) {
                resolver.warn && resolver.warn(`error with document.querySelector('${loc}')`, ctx);
                return undefined;
            }
        },

        find: () => {
            const base = tgt || e;
            if (!base) return undefined;

            try {
                let result = base.querySelector(loc);
                if (!result && base.matches && base.matches(loc)) result = base;
                if (!result) resolver.warn && resolver.warn(`couldnt find element with e.querySelector('${loc}')`, ctx);
                return result;
            } catch (err) {
                resolver.warn && resolver.warn(`couldnt find element with querySelector('${loc}')`, ctx);
                return undefined;
            }
        },

        closest: () => {
            const base = tgt || e;
            if (!base) return undefined;

            try {
                return base.closest(loc);
            } catch (err) {
                resolver.warn && resolver.warn(`couldnt find element with closest('${loc}')`, ctx);
                return undefined;
            }
        },

        // ---------------------------------------------------------------------
        // Form value lookup (legacy helper, but wired to v1 collect)
        // ---------------------------------------------------------------------
        form: () => {
            const base = tgt || e;
            if (!base) return undefined;

            const collect = lib.hash.get(lib, "site.form.collect");
            if (!collect) return undefined;

            const out = collect(base);
            const parms = out && out.parms;
            if (!parms) return undefined;

            for (let row of parms) {
                if (row[0] == loc) return row[1];
            }
            return undefined;
        },

        // ---------------------------------------------------------------------
        // Legacy inline (keep only if you still depend on it)
        // ---------------------------------------------------------------------
        inline: () => {
            if (!e) return undefined;
            return { src: e, prop: "innerHTML", special: loc };
        },
    };
}


# --- end: class/expressions/dispatch.js ---



# --- begin: class/expressions/ExpressionResolver.098.js ---

/**
 * ---------------------------------------------------------------------------
 * LEGACY / INACTIVE FILE - NOT USED BY ACTIVE TAGS RUNTIME
 * ---------------------------------------------------------------------------
 * @internal
 *
 * This file represents an older compatibility implementation ("098").
 * It is retained for historical/reference purposes only and is not part of
 * the active runtime execution path.
 *
 * Maintenance policy:
 * - Do not treat this file as source of truth for current behavior.
 * - Do not use this file for user/public documentation generation.
 * - Prefer `ExpressionResolver.js` for current runtime behavior.
 * ---------------------------------------------------------------------------
 */
/**
 * Expressions / Interpolation Trait
 * --------------------------------
 *
 * This trait implements Active Tags’ **expression resolution and interpolation
 * system**. It provides the machinery that allows symbolic string expressions
 * (e.g. `ws:user.id`, `ds:request.method`, `find:.title`) to be resolved into
 * live runtime values bound to a Job.
 *
 * Core responsibilities:
 * - Parse "target expressions" of the form `type:locator`
 * - Resolve those expressions against a Job’s runtime context
 *   (DOM element, dataset, workspace, request/response, etc.)
 * - Provide interpolation hooks compatible with `lib.str.interp()`
 * - Centralize all dynamic value lookup logic in one place
 *
 * What this trait does NOT do:
 * - It does NOT execute jobs or pipelines
 * - It does NOT schedule or time execution
 * - It does NOT mutate job state (except via controlled getters)
 * - It does NOT own or manage data lifecycles
 *
 * Architectural role:
 * - Serves as the symbolic “glue” between declarative markup/configuration
 *   and imperative runtime state
 * - Enables late binding: values are resolved at the moment they are needed,
 *   not when configuration is parsed
 * - Provides a single, extensible target-resolution system used by:
 *     - config interpolation (`data-config`)
 *     - request construction
 *     - response mapping
 *     - DOM binding
 *
 * Design notes:
 * - Target expressions are parsed into references first, then evaluated
 * - Evaluation is intentionally separated from parsing
 * - Custom target resolvers may be injected per call
 * - Some target types (e.g. DOM-based `eval`) are powerful and should only
 *   be used with trusted content
 *
 * This trait should remain:
 * - Pure in intent (resolution, not execution)
 * - Job-scoped (never global)
 * - Centralized (no ad-hoc expression parsing elsewhere)
 */


// -----------------------------------------------------------------------------
// DEPENDENCIES / ASSUMPTIONS (to be satisfied by host ActiveTags class)
// -----------------------------------------------------------------------------
// This trait assumes the following exist on `this`:
//
// REQUIRED:
// - this.toJob(job)              // normalize job-like inputs into a Job
// - this.warn(message, job?)     // optional warning/logger hook (used on lookup failures)
//
// EXPECTED JOB SHAPE:
// - job.e        : DOM Element bound to the job
// - job.ds       : Dataset object (from load trait)
// - job.ws       : Job workspace object
// - job.buffer   : Optional job buffer
// - job.r        : Optional request/response object
//
// OPTIONAL / LEGACY SUPPORT:
// - job may arrive wrapped in legacy `{ item, obj }` form (handled internally)
//
// ENVIRONMENT:
// - Browser DOM (document, window, Element)
//
// NOTE:
// - This trait performs expression parsing and value resolution ONLY.
// - It does NOT execute jobs, mutate state, or manage lifecycles.
// - Evaluation semantics are intentionally split between parseTarget / evalParse.
// -----------------------------------------------------------------------------
/**
this.expr = new ExpressionResolver({
  lib: this.lib,
  toJob: (x) => this.toJob(x),
  logger: this.logger,
  env: { window, document }
});
 */
import CONSTANTS from '../../constants.js';
import  WALKER from './expParser.js';
export class ExpressionResolver {


    constructor(opts = {}) {
	const lib = opts.lib;
	if (!lib) throw new Error("[ExpressionResolver] lib is required");

	this.lib = lib;
	this.toJob = opts.toJob || null;
	this.logger = opts.logger || null;
	this.walker = WALKER;
	// Prefer explicit env injection, fallback to lib._env.root
	const env = opts.env || {};

	const root = env.root || lib.hash.get(lib, "_env.root") || null;

	// Keep env around for callers that want it
	this.env = env;

	// Prefer injected window/document if provided, else derive from root
	this.window = env.window || root || null;
	this.document = env.document || (root && root.document ? root.document : null);
    }
    
    warn(msg, ctx) {
	//this should be our logging object, but for the time being we'll roll this , in the event its not yet setup properly.
	if (this.logger && typeof this.logger.warn === "function") {
	    this.logger.warn(msg, ctx);
	}
	
	//if(this.lib.utils.baseType(this.logger, "object") )
        //this.logger.warn(msg, ctx);
    }

    /**
     * Normalize job input (for debugging + uniform access).
     * If no toJob is provided, we accept {e, ds, ws} shape directly.
     */
    _asJob(job) {
	if(this.lib.utils.baseType(this.toJob, "function") )
            return this.toJob(job);
        return job;
    }


    /**
     * Build an interpolation scheme function for `lib.str.interp()`.
     *
     * This returns a resolver function that can be passed to `lib.str.interp()`
     * to replace tokens with live runtime values from the given Job context.
     *
     * The returned function accepts a single `target` expression (typically of the
     * form `type:locator`, e.g. `ws:user.id`, `ds:request.url`, `find:.title`) and:
     * - Resolves it via `parseTarget(job, target, custom)`
     * - If the resolved value is a scalar, returns it directly
     * - If the resolved value is a `{ src, prop }` reference, returns
     *   `lib.hash.get(src, prop)`
     * - Otherwise returns `undefined` (unresolvable / non-scalar)
     *
     * Compatibility note:
     * - Contains a legacy shim that accepts older "workspace wrapper" objects
     *   shaped like `{ item, obj }` and unwraps them to `job.item`.
     *
     * @param {Job|Object} job
     *        Job (or job-like) context used for resolution. The host is expected
     *        to provide `toJob()` to normalize job-like inputs.
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type. If present and a
     *        matching type exists, it overrides the built-in resolution behavior.
     *        (See `parseTarget()` for details.)
     *
     * @returns {(target: string) => (string|number|boolean|null|undefined)}
     *          A function compatible with `lib.str.interp()` that resolves a single
     *          interpolation token to a scalar value (or `undefined` if not resolvable).
     */



    interpScheme(job,custom={}){
	const lib = this.lib;
	//$fixup workspace to job compatibility hack
	if (lib.hash.is(job) && ('item' in job) && ('obj' in job)){
	    //console.log('legacy hack!');
	    job = job.item;
	}else job=this._asJob(job);

	let obj = this;
	//console.log('PREPARINGINTERP SCHEME',custom);
	return function(target){
	    let info = obj.parseTarget(job,target,custom);
	    //console.log('INSIDE SCHEME',info,lib.hash.is(info));
	    //$$fixup
	    //console.log(info);
	    if(lib.utils.isScalar(info))return info;
	    return (lib.hash.is(info) && info.src && info.prop)?
		lib.hash.get(info.src, info.prop):
		undefined;
	}
    }
    
    

    /**
     * Parse a target expression into a resolvable reference or value.
     *
     * `parseTarget` is the core expression-resolution function. It takes a symbolic
     * target string (typically of the form `type:locator`) and resolves it against
     * a Job’s runtime context.
     *
     * The result of this function is intentionally *not always a final value*.
     * Instead, it returns one of:
     * - A reference object: `{ src, prop }` (to be evaluated later)
     * - A DOM element
     * - A scalar value
     * - `undefined` if the target cannot be resolved
     *
     * Target expression format:
     * - `type:locator`
     *   - `type` selects a resolution strategy
     *   - `locator` identifies a property, path, or selector
     *
     * Built-in target types include:
     * - `inline`  : Job element innerHTML
     * - `request` : Request/response object (`job.r`)
     * - `window`  : Global `window` object
     * - `this`    : Job element (`job.e`)
     * - `ws`      : Job workspace (`job.ws`)
     * - `buffer`  : Job buffer (`job.buffer`)
     * - `ds`      : Job dataset (`job.ds`)
     * - `find`    : `job.e.querySelector(locator)` (fallbacks to `job.e`)
     * - `doc`     : `document.querySelector(locator)`
     * - `closest` : `job.e.closest(locator)`
     * - `form`    : Form field value collected from `job.e`
     *
     * Resolution behavior:
     * - If the target resolves to a reference `{ src, prop }`, it is returned as-is
     *   for later evaluation.
     * - If the target resolves to a DOM element or scalar, it is returned directly.
     * - Unknown or invalid target types default to `inline`.
     *
     * Custom resolution:
     * - If a `custom` resolver map is provided and contains a matching `type`,
     *   that resolver is used instead of the built-in behavior.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context. The host
     *        is expected to provide `toJob()` to normalize job-like inputs.
     *
     * @param {string} target
     *        Target expression string to resolve (e.g. `ws:user.id`).
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type.
     *        Custom resolvers receive the `locator` string and should return a
     *        value or reference compatible with this method’s return contract.
     *
     * @returns {Object|Element|string|number|boolean|undefined}
     *          A reference object, DOM element, scalar value, or `undefined`
     *          if the target cannot be resolved.
     *
     * @notes
     * - This method does not evaluate references; it only parses and resolves them.
     * - Final value extraction is handled by `evalParse()` or by the interpolation
     *   scheme returned from `interpScheme()`.
     * - Warnings may be emitted if selectors fail to resolve.
     */
    parseTarget(job,target,custom={}){
	job = this._asJob(job);
	const lib = this.lib;
	if(!target)return undefined;
	let splitter = function (str, exp=/\s+/,count=0){
	    str = lib.utils.toString(str,1);
	    let pos = str.indexOf(':');
	    return [str.substr(0,pos),pos>-1?str.substr(pos+1):undefined];

	};

	const thisWindow = this.window;
	const thisDocument = this.document;
	let data;
	//let [type,loc] = target.split(/:/,2);
	let [type,loc] = splitter(target);
	if (!type) return undefined;
	type = (type+"").toLowerCase();
	let disp = {
	    "inline": () =>{
		return {
		    src: job.e,
		    prop: "innerHTML",
		    special: loc
		}
	    },
	    "request": ()=>{
		return {
		    src: job.r,
		    prop: loc
		}
	    },
	    "window": () =>{
		return {
		    src: thisWindow,
		    prop: loc
		}
	    },
	    "this":  () =>{
		return {
		    src: job.e,
		    prop: loc
		}
	    },
	    "ws":  () =>{
		//console.log(`>>ws.${loc}=`+lib.hash.get(job.ws,loc));
		
		return {
		    src: job.ws,
		    prop: loc
		}
	    },
	    "buffer": () =>{
		return{
		    src:job.buffer,
		    prop:loc
		};
	    },
	    "ds":() =>{
		return {
		    src:job.ds,
		    prop: loc
		}
	    },
	    "find": () =>{
		let result = undefined;
		//console.log('running find on ',job.e,loc);
		try{
		    result = job.e.querySelector(loc);
		    //console.log("found " , result);
		    if(!result && job.e.matches(loc))result = job.e;

		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with querySelector('${loc}')`,job);
		}
		if(!result)this.warn(`couldnt find element with e.querySelector('${loc}')`);
		return result;
	    },
	    "doc": () =>{
		let result = undefined;
		try{
		    result = thisDocument.querySelector(loc);
		}catch{
		    result = undefined;
		    this.warn(`error with  querySelector(selector '${loc}')`);
		}
		if(!result)this.warn(`couldnt find element with document.querySelector('${loc}')`);
		return result;
	    },
	    "closest": ()=>{
		let result = undefined;
		try{
		    result = job.e.closest(loc);
		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with closest(selector '${loc}' )`);
		}
		return result;

	    },
	    "form": ()=>{
		let form = lib.dom.form.collect(job.e);
		if(!form) return undefined;
		for (let row of form.parms){
		    if (row[0] == loc)return row[1];
		}
		return undefined;
	    },
	    "default": () =>{
		return undefined;
	    }
	};

	if (lib.hash.is(custom) && type in custom){
	    console.log(custom, type,loc,custom[type]);
	    return lib.func.get(custom[type]) ?
		custom[type](loc):
		{src: custom[type],prop:loc};
	}else {
	    if (!(type in disp))type="inline";
	    return disp[type]();
	}
    }

    /**
     * Resolve and evaluate a target expression to its final value.
     *
     * `evalTarget` is a convenience wrapper that combines:
     * - `parseTarget()` to resolve a symbolic target expression, and
     * - `evalParse()` to extract the concrete value from the resolved reference.
     *
     * This method is useful when a one-off value lookup is needed and there is
     * no need to separate parsing from evaluation.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context.
     *
     * @param {string} target
     *        Target expression string to resolve and evaluate
     *        (e.g. `ws:user.id`, `ds:request.method`).
     *
     * @param {Object} [custom]
     *        Optional custom resolver map passed through to `parseTarget()`.
     *
     * @returns {*}
     *          The resolved value of the target expression, or `undefined`
     *          if the target cannot be resolved or evaluated.
     *
     * @notes
     * - This method eagerly evaluates the target and returns a concrete value.
     * - For finer control (e.g. deferred evaluation), use `parseTarget()` directly.
     */
    evalTarget(job, target,custom){
	let parse = this.parseTarget(...arguments);
	return this.evalParse(parse);
    }


    /**
     * Evaluate a parsed target reference into a concrete value.
     *
     * `evalParse` takes the output of `parseTarget()` and resolves it to its final
     * runtime value.
     *
     * Evaluation rules:
     * - If the input is a reference object of the form `{ src, prop }`:
     *     - If `src` is a DOM element, resolves via `lib.dom.get(src, prop)`
     *     - Otherwise, resolves via `lib.hash.get(src, prop)`
     * - If the input is not a reference object, it is returned unchanged
     *
     * @param {*} parse
     *        Parsed target returned from `parseTarget()`. May be a reference
     *        object, DOM element, scalar value, or `undefined`.
     *
     * @returns {*}
     *          The resolved runtime value, or the original input if no evaluation
     *          is required.
     *
     * @notes
     * - This function performs no parsing or validation.
     * - It assumes reference objects are well-formed.
     * - This method is intentionally small and deterministic.
     */
    evalParse(parse){
	const lib = this.lib;
	console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src) ?
		lib.dom.get(parse.src, parse.prop):
		lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    }


     //v098 parser
    //basic string parsing is supported, but generally speaking if you want more complex handling, use json configs
    //not currently implemented into the previous functions, used for v1 bridging.
    // e:.config
    // foo:1,2,3
    //err is not yet implemented. malformed data will be truncated.
    parseList(input,err){
        const lib = this.lib;
        input = lib.utils.deepCopy(input);
        input = lib.array.to(input,CONSTANTS.ARR_TO_OPTS);
        const output = [];
        for (let i =0; i < input.length; i++){
            const item = input[i];
            //console.log('item' , item);
            if(lib.hash.is(item)){
                output.push(item);
                continue;
            }

            if (lib.str.is(item) ){

                const comp = {raw:item};
                const idx= item.indexOf(':');
                if (idx === -1){
                    comp.op = item;
                    comp.args = [];
                    comp.raw = item;
                }else {
                    comp.op = item.substr(0,idx);
                    const rem = item.substr(idx+1);
                    const arr = lib.array.to(rem, {split:/\,/,trim:true} );
                    comp.args = arr;
                    comp.raw = item;
                }
                output.push(comp);
                continue;
            }
            if(lib.func.get(err) ){

            }
        }
        return output;
    }
    
    walk(input){
	return WALKER.parseExpressions(input);
    }
}

export default ExpressionResolver;


# --- end: class/expressions/ExpressionResolver.098.js ---



# --- begin: class/expressions/ExpressionResolver.js ---

/**
 * ExpressionResolver
 * ------------------
 *
 * Class responsible for parsing and resolving ActiveTags expression targets
 * (for example: `job:id`, `target:innerHTML`, `find:.title`) against runtime context.
 *
 * Core responsibilities:
 * - Parse target expressions of the form `type:locator`
 * - Resolve those expressions against a runtime context (`ctx`)
 *   that may include:
 *     - job
 *     - ticket
 *     - buffer / buffer metadata
 *     - DOM elements (this / target / document queries)
 *     - configuration schema
 *     - transaction records
 * - Provide a single evaluation entry point (`eval(ctx, target)`)
 * - Support higher-level interpolation via a dedicated interpolator
 *
 * What this class does NOT do:
 * - It does NOT execute jobs, stacks, or pipelines
 * - It does NOT schedule, queue, or control execution flow
 * - It does NOT mutate job or ticket state
 * - It does NOT manage data lifecycles or persistence
 * - It does NOT assume global state (all resolution is context-driven)
 *
 * Architectural role:
 * - Acts as the symbolic “glue” between declarative configuration and
 *   imperative runtime state
 * - Enables late binding: values are resolved at evaluation time, not
 *   at configuration or compile time
 * - Centralizes all dynamic lookup logic so no other subsystem performs
 *   ad-hoc expression parsing
 *
 * Resolution model:
 * - Target strings are first *parsed* into references or direct values
 * - Parsed targets are then *evaluated* to produce a final value
 * - Parsing and evaluation are intentionally separate concerns
 * - Unknown or unsupported targets resolve to `undefined` (no magic fallbacks)
 *
 * Extensibility:
 * - Target resolution is driven by a dispatcher that may evolve over time
 * - New target types (e.g. `inputs:`, `vars:`, `stage:`) can be added
 *   without changing the public API
 * - Custom resolution behavior may be injected via the evaluation context
 *
 * Security & discipline notes:
 * - DOM-based resolution (e.g. `find`, `closest`, `this`, `target`) is powerful
 *   and must only be used with trusted configuration
 * - This class should remain deterministic, explicit, and boring
 *
 * This class must remain:
 * - Context-driven (never global)
 * - Side-effect free
 * - Centrally authoritative for expression resolution
 */


/**
 * Example:
 *   this.expr = new ExpressionResolver({
 *     lib: this.lib,
 *     toJob: (x) => this.toJob(x),
 *     logger: this.logger,
 *     env: { window, document }
 *   });
 */
import CONSTANTS    from '../../constants.js';
import Interpolator from './Interpolator.js';
import buildDispatch from './dispatch.js';
export class ExpressionResolver {

    /**
     * Create a new ExpressionResolver instance.
     *
     * The resolver is responsible for parsing and evaluating symbolic target
     * expressions (e.g. `job:id`, `buffer_meta:headers.Authorization`,
     * `find:.title`) against a provided execution context.
     *
     * This constructor wires the resolver to:
     * - the Active Tags `lib` (required)
     * - an optional job normalization adapter (`toJob`)
     * - an optional logger
     * - an execution environment (`env`)
     *
     * Environment resolution:
     * - If `opts.env` is provided, it is treated as the authoritative environment
     *   for this resolver instance.
     * - Otherwise, the resolver falls back to the environment installed on `lib`
     *   (via `lib._env`, typically created by `lib/_env` boot).
     * - The resolved environment is used to derive canonical `window` and
     *   `document` references without directly probing globals.
     *
     * The resolver itself is:
     * - context-driven (no implicit global state)
     * - side-effect free
     * - safe to reuse across jobs and tickets
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *   The m7 lib instance. Required.
     *
     * @param {Function} [opts.toJob]
     *   Optional adapter used to normalize or coerce values into Job instances
     *   before resolution. If omitted, the resolver will use the provided value
     *   as-is.
     *
     * @param {Object} [opts.logger]
     *   Optional logger implementation used for warnings or diagnostics.
     *
     * @param {Object} [opts.env]
     *   Optional explicit environment injection.
     *   When provided, this environment takes precedence over `lib._env`.
     *   Typical shape:
     *     {
     *       root: <global root>,
     *       window: <window/global>,
     *       document: <document>
     *     }
     *
     * @throws {Error}
     *   If `opts.lib` is not provided.
     */
    constructor(opts = {}) {
	const lib = opts.lib;
	if (!lib) throw new Error("[ExpressionResolver] lib is required");

	this.lib = lib;

	// adapters / utilities
	this.toJob  = opts.toJob || null;
	this.logger = opts.logger || null;
	this.interp = Interpolator;

	// ---------------------------------------------------------------------
	// Environment (m7-lib native)
	//  - Prefer caller-provided opts.env (explicit injection)
	//  - Else prefer lib._env (installed by lib/_env boot)
	//  - Else fallback to lib.hash.get(lib,"_env") / lib.hash.get(lib,"_env.root")
	// ---------------------------------------------------------------------

	// 1) explicit env injection (may be empty object)
	const env = lib.hash.is(opts.env) ? opts.env : {};

	// 2) lib env (preferred fallback)
	const libEnv  = lib._env || lib.hash.get(lib, "_env") || null;
	const root    = env.root || (libEnv && libEnv.root) || lib.hash.get(lib, "_env.root") || null;

	// keep env for callers
	// if caller didn’t provide env, we still expose the derived lib env shape
	this.env = env.root || env.window || env.document
            ? env
            : (libEnv || { root });

	// canonical window/document references
	// window => root (globalThis/window/global)
	// document => root.document (browser only)
	this.window   = env.window   || root || null;
	this.document = env.document || (root && root.document ? root.document : null);
    }

    /**
     * Emit a non-fatal warning during expression parsing or evaluation.
     *
     * This method is intentionally conservative:
     * - It never throws
     * - It never assumes a logger is present
     * - It performs no formatting or interpolation
     *
     * Warnings are routed to the injected logger (if provided), allowing
     * higher-level systems to decide how diagnostics are surfaced
     * (console, telemetry, devtools, etc.).
     *
     * This method exists so the expression resolver can report:
     * - invalid selectors
     * - missing targets
     * - unsafe or unsupported expressions
     *
     * without disrupting execution flow.
     *
     * @param {string} msg
     *   Human-readable warning message.
     *
     * @param {Object} [ctx]
     *   Optional execution context associated with the warning.
     *   This is passed through verbatim to the logger for debugging
     *   or diagnostic correlation.
     */

    warn(msg, ctx) {
	// Soft warning channel: no throw, no assumptions
	if (this.logger && typeof this.logger.warn === "function") {
            this.logger.warn(msg, ctx);
	}
    }


    /**
     * Normalize a job-like value into a Job instance (if possible).
     *
     * This helper exists to decouple the expression resolver from any
     * specific Job implementation. If a `toJob` adapter was provided at
     * construction time, it will be used to coerce or normalize the input.
     *
     * If no adapter is provided, the input value is returned as-is.
     *
     * This allows the resolver to:
     * - accept real Job instances
     * - accept job-like objects during testing or debugging
     * - avoid hard dependencies on Job internals
     *
     * @param {*} job
     *   A Job instance, job-like object, or arbitrary value.
     *
     * @returns {*}
     *   The normalized Job instance if an adapter is available,
     *   otherwise the original value.
     */
    _asJob(job) {
	if (this.lib.utils.baseType(this.toJob, "function")) {
            return this.toJob(job);
	}
	return job;
    }

    /**
     * Parse a target expression into a resolvable reference.
     *
     * A target expression has the general form:
     *
     *   "type:locator"
     *
     * Examples:
     *   "job:id"
     *   "config:confirm.text"
     *   "this:innerHTML"
     *   "target:value"
     *   "window:location.href"
     *   "doc:#id"
     *   "find:.title"
     *
     * This method performs **parsing only**. It does not evaluate or resolve
     * the expression to a concrete value.
     *
     * Resolution strategy:
     * - The target string is split on the first `:`
     * - A dispatcher is built using the provided execution context (`ctx`)
     * - If a built-in dispatcher exists for `type`, it is invoked
     * - Otherwise, the context itself may provide an override handler
     * - Unknown target types resolve to `undefined` (no implicit fallbacks)
     *
     * The returned value is one of:
     * - a target reference object `{ src, prop }`
     * - a DOM element
     * - a direct value
     * - `undefined` if the target cannot be resolved
     *
     * The execution context (`ctx`) is free-form and may contain any data
     * required by target resolvers. Commonly used slots include:
     *   - job
     *   - ticket
     *   - buffer
     *   - env
     *   - trigger
     *
     * @param {Object} ctx
     *   Free-form execution context used to build the target dispatcher.
     *
     * @param {string} target
     *   Target expression string to parse.
     *
     * @returns {*}
     *   A parsed target reference, direct value, DOM element, or `undefined`.
     */
    parse(ctx, target) {
	const lib = this.lib;

	ctx = lib.hash.to(ctx) || {};
	if (!target) return undefined;

	// split only on first colon
	target = lib.utils.toString(target, 1);
	const pos = target.indexOf(":");
	const typeRaw = (pos < 0) ? target : target.slice(0, pos);
	const loc = (pos < 0) ? undefined : target.slice(pos + 1);

	if (!typeRaw) return undefined;

	const type = String(typeRaw).toLowerCase().trim();

	const disp = buildDispatch(this, ctx, loc);

	// 1) Prefer built-in dispatch if it exists
	// Note: dispatcher closures already capture ctx + loc
	if (Object.prototype.hasOwnProperty.call(disp, type)) {
            return disp[type]();
	}

	// 2) Otherwise allow ctx override (greater ctx)
	// ctx[type] may be a function (or function reference) or a value
	if (lib.hash.is(ctx) && type in ctx) {
            const custom = ctx[type];
            const fn = lib.func.get(custom);
            if (fn) return fn(loc);
            return { src: custom, prop: loc };
	}

	// 3) Unknown target type => undefined (no magic)
	return undefined;
    }
    
    /**
     * Evaluate a target expression and return its resolved value.
     *
     * This method is a convenience wrapper that combines:
     * - `parse(ctx, target)` to interpret a symbolic target expression, and
     * - `evalParse(parse)` to extract the concrete value from the parsed result.
     *
     * It is intended for one-off or immediate resolution of target expressions.
     * For advanced use cases (e.g. deferred evaluation or inspection of parsed
     * targets), callers may invoke `parse()` and `evalParse()` separately.
     *
     * Evaluation behavior:
     * - If the target resolves to a `{ src, prop }` reference, the property is
     *   retrieved using `lib.hash.get()` or `lib.dom.get()`.
     * - If the target resolves directly to a value or DOM element, it is returned
     *   as-is.
     * - Unknown or unsupported targets resolve to `undefined`.
     *
     * @param {Object} ctx
     *   Free-form execution context used for resolution.
     *   Common fields include:
     *     - job
     *     - ticket
     *     - buffer
     *     - env
     *
     * @param {string} target
     *   Target expression string to evaluate (e.g. `"job:id"`, `"config:name"`,
     *   `"find:.title"`).
     *
     * @returns {*}
     *   The resolved value of the target expression, or `undefined` if the target
     *   cannot be resolved.
     */
    eval(ctx, target) {
	const parse = this.parse(ctx, target);
	return this.evalParse(parse);
    }
    

    /**
     * Evaluate a parsed target result into a concrete runtime value.
     *
     * `evalParse` takes the output of `parse(ctx, target)` and resolves it to
     * its final value.
     *
     * Evaluation rules:
     * - If the input is a target reference object of the form `{ src, prop }`:
     *     - If `src` is a DOM element, the value is resolved via
     *       `lib.dom.get(src, prop)`
     *     - Otherwise, the value is resolved via `lib.hash.get(src, prop)`
     * - If the input is a DOM element, it is returned as-is
     * - If the input is a scalar value, it is returned unchanged
     * - If the input is `undefined` or `null`, `undefined` is returned
     *
     * This method performs no parsing and no validation. It assumes the parsed
     * input is well-formed and deterministic.
     *
     * @param {*} parse
     *   Parsed target returned from `parse(ctx, target)`. This may be:
     *     - a target reference object `{ src, prop }`
     *     - a DOM element
     *     - a scalar value
     *     - `undefined`
     *
     * @returns {*}
     *   The resolved runtime value, or the original input if no evaluation
     *   is required.
     */
    evalParse(parse) {
	const lib = this.lib;

	if (parse == null) return undefined;
	if (!lib.utils.baseType(parse, "object")) return parse;
	if (lib.dom.is(parse)) return parse;

	const src  = lib.hash.get(parse, "src");
	const prop = lib.hash.get(parse, "prop");

	// Not a TargetRef → return as-is
	if (src === undefined || src === null) return parse;

	// No property specified → return source
	if (prop == null || prop === "") return src;

	return lib.dom.is(src)
            ? lib.dom.get(src, prop)
            : lib.hash.get(src, prop);
    }

    /**
     * Parse a compact v098-style op list into normalized op records.
     *
     * Supported input items:
     * - Object: passed through unchanged (assumed already normalized)
     * - String:
     *    - "op"           -> { op:"op", args:[], raw:"op" }
     *    - "op:a,b,c"     -> { op:"op", args:["a","b","c"], raw:"op:a,b,c" }
     *
     * Notes:
     * - This is a compatibility parser intended for v1 bridging.
     * - Malformed items are ignored unless an `err` handler is provided.
     * - This function does NOT evaluate expressions; it only tokenizes.
     *
     * @param {*} input
     *   Array-like, string, or mixed list of entries.
     *
     * @param {Function} [err]
     *   Optional error callback invoked as err(reason, { item, index }).
     *
     * @returns {Array<Object>}
     *   Normalized list of op records / objects.
     */
    parseList(input, err) {
	const lib = this.lib;

	// copy + normalize to array
	const src = lib.array.to(lib.utils.deepCopy(input), CONSTANTS.ARR_TO_OPTS);
	const out = [];

	const onErr = lib.func.get(err);

	for (let i = 0; i < src.length; i++) {
            const item = src[i];

            // pass-through object (already normalized)
            if (lib.hash.is(item)) {
		out.push(item);
		continue;
            }

            // string shorthand: "op" or "op:a,b,c"
            if (lib.str.is(item)) {
		const raw = item;

		const idx = raw.indexOf(":");
		if (idx === -1) {
                    out.push({ op: raw, args: [], raw });
                    continue;
		}

		const op = raw.substr(0, idx);
		const rem = raw.substr(idx + 1);

		const args = lib.array.to(rem, { split: /,/, trim: true });
		out.push({ op, args, raw });
		continue;
            }

            // unknown item type
            if (onErr) onErr("invalid_item", { item, index: i });
	}

	return out;
    }

    
    /**
     * Materialize interpolations within an arbitrary value using the provided context.
     *
     * This is a convenience wrapper that:
     *  1) parses `${...}` tokens within strings (deep scan), and
     *  2) evaluates them against `ctx` using this resolver’s target evaluation (`eval`).
     *
     * Encapsulated expressions like `"${job:id}"` materialize to the raw underlying value.
     * Template expressions like `"id=${job:id}"` materialize to strings.
     *
     * @param {Object} ctx
     *   Free-form execution context used for evaluation (job, ticket, env, etc).
     *
     * @param {*} value
     *   Any value (object/array/string/scalar) that may contain `${...}` tokens.
     *
     * @returns {*}
     *   A structurally equivalent value with all `${...}` expressions materialized.
     */
    materialize(ctx, value) {
	const parsed = this.interp.parseExpressions(value);

	return this.interp.evalCompiled(parsed, (expr) => {
            // `expr` is the inner string from `${...}` without the braces
            return this.eval(ctx, expr);
	});
    }
}

export default ExpressionResolver;


# --- end: class/expressions/ExpressionResolver.js ---



# --- begin: class/expressions/Interpolator.js ---


/**
 * Deep-parses an arbitrary value and precompiles interpolatable expressions.
 *
 * This function walks any JavaScript value (object, array, or scalar) and
 * detects strings containing `${...}` expression tokens. It does NOT resolve
 * expressions; it only classifies and prepares them for later evaluation.
 *
 * The scan is deep and structural:
 * - Objects are traversed by key
 * - Arrays are traversed by index
 * - Non-string scalars are returned unchanged
 *
 * Expression rules:
 * 1) Encapsulated expression
 *    A string that consists of exactly ONE expression token and nothing else:
 *
 *      "${foo}"
 *
 *    This is treated as a *value expression*.
 *    At runtime, evaluation MUST return the raw resolved value
 *    (number, object, DOM node, etc.), NOT a string.
 *
 * 2) Template expression
 *    A string that contains one or more expression tokens mixed with
 *    surrounding text:
 *
 *      "${foo} - ${bar}"
 *      "hello ${name}"
 *
 *    This is treated as a *template expression*.
 *    At runtime, evaluation MUST return a string produced by interpolation.
 *
 * 3) Non-expression string
 *    Strings with no `${...}` tokens are returned unchanged.
 *
 * Output contract:
 * - The returned structure mirrors the input structure exactly.
 * - Parsed expressions may be replaced with a compiled descriptor object
 *   suitable for fast runtime evaluation.
 * - No resolution, evaluation, or side effects occur during parsing.
 *
 * Purpose:
 * - Allow expressions to be parsed once at job/config creation time
 * - Avoid repeated token scanning during execution
 * - Preserve correct value vs string semantics at runtime
 *
 * @param {*} input
 *   Any JavaScript value: object, array, string, number, boolean, null, etc.
 *
 * @returns {*}
 *   A deep-cloned or structurally equivalent value with interpolatable
 *   expressions precompiled. Non-expression values are returned as-is.
 */


const EXPR_RE = /\$\{([^}]+)\}/g;
const FULL_EXPR_RE = /^\$\{([^}]+)\}$/;


/**
 * Deep-parse interpolatable expressions inside an arbitrary value.
 *
 * @param {*} input
 * @returns {*}
 */
export function parseExpressions(input) {
    // fast exits
    if (input == null) return input;

    const t = typeof input;

    if (t === "string") {
        return parseStringExpr(input);
    }

    if (Array.isArray(input)) {
        let out = new Array(input.length);
        for (let i = 0; i < input.length; i++) {
	    out[i] = parseExpressions(input[i]);
        }
        return out;
    }

    if (t === "object") {
        let out = {};
        for (const k in input) {
	    if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
	    out[k] = parseExpressions(input[k]);
        }
        return out;
    }

    // number, boolean, function, symbol, etc
    return input;
}

/**
 * Parse a single string and detect expression semantics.
 *
 * @param {string} str
 * @returns {string|object}
 */
function parseStringExpr(str) {
    // quick reject
    if (str.indexOf("${") === -1) {
        return str;
    }

    // case 1: fully encapsulated value expression
    const full = FULL_EXPR_RE.exec(str);
    if (full) {
        return {
	    __expr: true,
	    kind: "value",
	    raw: str,
	    parts: [
                { expr: full[1].trim() }
	    ]
        };
    }

    // case 2: template expression
    let parts = [];
    let lastIndex = 0;
    let match;

    EXPR_RE.lastIndex = 0;

    while ((match = EXPR_RE.exec(str))) {
        const idx = match.index;

        if (idx > lastIndex) {
	    parts.push(str.slice(lastIndex, idx));
        }

        parts.push({ expr: match[1].trim() });
        lastIndex = EXPR_RE.lastIndex;
    }

    if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex));
    }

    return {
        __expr: true,
        kind: "template",
        raw: str,
        parts
    };
}


export function evalCompiled(node, resolveExpr) {
  if (node == null) return node;

  // expression descriptor
  if (node && typeof node === "object" && node.__expr === true) {
    if (node.kind === "value") {
      // raw value return (not string)
      return resolveExpr(node.parts[0].expr);
    }
    // template => string
    return node.parts.map(p => (
      typeof p === "string" ? p : String(resolveExpr(p.expr))
    )).join("");
  }

  if (Array.isArray(node)) return node.map(x => evalCompiled(x, resolveExpr));

  if (typeof node === "object") {
    const out = {};
    for (const k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      out[k] = evalCompiled(node[k], resolveExpr);
    }
    return out;
  }

  return node;
}
/*
// inside VM step, before calling the op
const resolvedArgs = evalCompiled(v.args, (expr) => {
  // this is where ExpressionResolver does the real work
  return at.expr.eval(expr, { job, ticket, inputs, ctx, trigger });
});

// then call builtin
res = await builtin({
  job,
  args: resolvedArgs,
  ticket,
  inputs,
  ctx,
  trigger,
  step: v.stepRec,
});
*/
export const WALKER = {parseExpressions, evalCompiled} ;

export default WALKER;


# --- end: class/expressions/Interpolator.js ---



# --- begin: class/interval/Controller.js ---

/**
 * Interval Controller
 * -------------------
 *
 * Manages interval-based pipeline triggers for ActiveTags Jobs.
 *
 * This controller separates three distinct concerns:
 *
 *   Registration   discovery of interval definitions from Job schema
 *   Enable state   logical permission for an interval to run
 *   Runtime state  whether an interval is currently active
 *
 *
 * REGISTRATION
 * ------------
 * register() and registerAll() read interval definitions from Job
 * configuration and populate the internal registry.
 *
 * Registration does not start timers.
 * Registration does not execute pipelines.
 * Registration does not modify existing runtime timers.
 *
 *
 * ENABLE STATE
 * ------------
 * An interval may be enabled or disabled.
 *
 * Enabled means the interval is allowed to run if turned on.
 * Disabled intervals will not start and will be stopped if running.
 *
 * Calling disable() guarantees the interval is not running.
 *
 *
 * RUNTIME STATE
 * -------------
 * on() activates eligible enabled intervals.
 * off() stops active intervals.
 *
 * Enabled does not imply running.
 * Running requires an explicit call to on().
 *
 *
 * REMOVAL
 * -------
 * remove(job) stops all active intervals for the Job and removes
 * its interval definitions from the registry.
 *
 *
 * IDEMPOTENCY
 * -----------
 * registerAll() may be called multiple times.
 * It updates registry definitions but does not automatically
 * restart or recreate active timers.
 *
 *
 * EXECUTION BOUNDARY
 * ------------------
 * This controller orchestrates interval lifecycle only.
 *
 * Timer scheduling is delegated to the injected interval service.
 * Pipeline execution is delegated to the Engine.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * The controller must not execute pipelines directly.
 * The controller must not manage retry logic.
 * The controller must not mutate Job configuration.
 */

export class Controller {
    /**
     * Create a new Interval Controller.
     *
     * CONTRACT
     * --------
     * The Interval Controller requires a fully initialized ActiveTags instance and
     * its core runtime dependencies. It must be constructed only after:
     *   AT.engine exists
     *   AT.svc.interval exists
     *
     * Construction performs validation and reference caching only.
     * No timers are created.
     * No pipelines are executed.
     * No registry entries are created.
     *
     *
     * REQUIRED DEPENDENCIES
     * ---------------------
     * @param {Object} opts
     *
     * @param {ActiveTags} opts.AT
     *   The owning ActiveTags instance.
     *   Must expose:
     *     engine
     *     svc.interval
     *
     * @param {Object} opts.lib
     *   The m7 lib instance used for normalization and internal utilities.
     *
     * @param {Function} opts.toJob
     *   Resolver used to normalize job-like inputs into Job instances.
     *   Signature: toJob(x) returns Job or null.
     *
     *
     * BEHAVIOR
     * --------
     * Validates required dependencies.
     * Caches stable references to AT, engine, intervalManager, and lib.
     * Initializes an empty interval registry keyed by jobId and intervalName.
     * Freezes the controller instance to prevent mutation of its public surface.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if AT is missing.
     * Throws if AT.engine is missing.
     * Throws if AT.svc.interval is missing.
     * Throws if lib is missing.
     * Throws if toJob is not a function.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register intervals.
     * Does not start or stop timers.
     * Does not enqueue or execute pipelines.
     */
    constructor({ AT, lib, toJob } = {}) {
	if (!AT) throw new Error("IntervalController requires { AT }");
	if (!AT.engine) throw new Error("IntervalController requires AT.engine");
	if (!AT.svc || !AT.svc.interval) throw new Error("IntervalController requires AT.svc.interval");
	if (!lib) throw new Error("IntervalController requires { lib }");
	if (typeof toJob !== "function") throw new Error("IntervalController requires { toJob } function");

	this.AT = AT;
	this.engine = AT.engine;
	this.intervalManager = AT.svc.interval;
	this.lib = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// internal registry
	// jobId -> Map(intervalName -> state)
	this.registry = new Map();
	Object.freeze(this);
    }
    /**
     * Destroy the Interval Controller.
     *
     * CONTRACT
     * --------
     * destroy() stops all active intervals managed by this controller
     * and clears the internal registry.
     *
     * After destroy() completes:
     *   No interval managed by this controller will be running.
     *   The internal registry will be empty.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Calls off() to cancel all active intervals.
     * 2. Clears all registry entries.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels timers via the injected interval service.
     * Removes all tracked interval definitions from the controller.
     *
     *
     * POSTCONDITION
     * -------------
     * The controller remains instantiated but contains no registered intervals.
     * Further calls to on() will have no effect until intervals are re-registered.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not destroy the injected interval service.
     * Does not mutate Job configuration.
     * Does not enqueue or execute pipelines.
     */
    destroy() {
	this.off();          // cancel all intervals
	this.registry.clear();
    }

    /**
     * Register interval definitions for all eligible Jobs.
     *
     * CONTRACT
     * --------
     * registerAll() scans the JobRegistry and registers interval
     * definitions for each eligible Job.
     *
     * It does not start timers.
     * It does not execute pipelines.
     * It does not enable or disable intervals.
     *
     *
     * ELIGIBILITY RULES
     * -----------------
     * A Job is processed only if:
     *   job exists
     *   job.config.schema.enable.enabled is true
     *
     * Jobs failing eligibility are skipped.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Retrieves all Jobs from AT.jobs.list().
     * 2. Filters out disabled Jobs.
     * 3. Calls register(job) for each eligible Job.
     * 4. Returns the number of Jobs processed.
     *
     *
     * IDEMPOTENCY
     * -----------
     * May be called multiple times.
     * Re-registering a Job refreshes its interval definitions in the registry.
     * Existing active timers are not automatically restarted.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of Jobs for which register(job) was invoked.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Populates or updates entries in the internal interval registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not enqueue pipelines.
     * Does not mutate Job configuration.
     */
    registerAll() {
	const lib = this.lib;
	const AT  = this.AT;

	const jobs = AT.jobs.list();
	if (!lib.array.len(jobs)) return 0;

	let count = 0;

	for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            // register all intervals for this job
            this.register(job);
            count++;
	}

	return count;
    }    
    
    /**
     * Register interval definitions for a single Job.
     *
     * CONTRACT
     * --------
     * register() reads interval definitions from a Job configuration block and
     * stores normalized interval entries in the internal registry.
     *
     * It does not start timers.
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     * This is a Job-scoped registry operation.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * SOURCE CONFIG
     * -------------
     * Interval definitions are read from:
     *   job.config.schema.intervals
     *
     * The intervals block is expected to be an object whose keys are interval names.
     *
     *
     * NORMALIZATION RULES
     * -------------------
     * For each interval record:
     *   enabled defaults to true unless explicitly disabled
     *   repeat must be a finite number greater than zero
     *   pipeline must be a non-empty string
     *
     * Records that fail structural requirements are skipped.
     *
     * Disabled intervals are still registered so they may be enabled later.
     *
     *
     * REGISTRY EFFECT
     * ---------------
     * Registry layout is:
     *   registry.get(jobId) returns Map(intervalName -> entry)
     *
     * Each entry contains:
     *   jobId
     *   name
     *   enabled
     *   on
     *   def
     *
     * Re-registering replaces the stored entry definition and resets on to false.
     * This method does not stop or restart any active timers.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval entries added or replaced for the Job.
     *
     *
     * FAILURE MODES
     * -------------
     * Returns 0 if jobLike cannot be resolved to a Job with an id.
     * Returns 0 if the intervals block is missing or not an object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Creates or updates registry entries for the resolved Job id.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not cancel existing timers.
     * Does not mutate Job configuration.
     */
    register(jobLike) {
	const lib = this.lib;

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const intervals = lib.hash.get(job, "config.schema.intervals");
	if (!lib.hash.is(intervals)) return 0;

	let jobEntry = this.registry.get(job.id);
	if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
	}

	let count = 0;

	for (const name in intervals) {
            const rec = lib.hash.get(intervals, name);
            if (!rec) continue;

            // keep disabled intervals too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity (register even if disabled, but only if structurally usable)
            const repeat = Number(lib.hash.get(rec, "repeat") || 0);
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!Number.isFinite(repeat) || repeat <= 0) continue;
            if (!pipeline) continue;

            jobEntry.set(name, {
		jobId: job.id,
		name,
		enabled,
		on: false,
		def: rec
            });

            count++;
	}

	return count;
    }
    
    /**
     * Remove all interval definitions for a single Job.
     *
     * CONTRACT
     * --------
     * remove() stops all active intervals for the resolved Job and
     * removes its interval entries from the internal registry.
     *
     * Removal implies off.
     * After removal, no interval for the Job will remain registered
     * or running under this controller.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. If no registry entry exists for the Job, returns 0.
     * 3. Calls off(job) to cancel any active intervals.
     * 4. Deletes the Job entry from the registry.
     * 5. Returns the number of interval definitions removed.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval entries removed for the Job.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels any active timers associated with the Job.
     * Removes all stored interval definitions for the Job.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not mutate Job configuration.
     * Does not destroy the injected interval service.
     * Does not enqueue or execute pipelines.
     */
    remove(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const count = jobEntry.size;
	
	// runtime: cancel any active intervals first
	this.off(job);
	
	this.registry.delete(job.id);

	return count;
    }

    /**
     * List interval state for a single Job.
     *
     * CONTRACT
     * --------
     * listJob() returns a snapshot of the logical and runtime state
     * of all intervals registered for a resolved Job.
     *
     * It does not mutate registry state.
     * It does not start or stop intervals.
     * It does not access the interval service.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Resolves the Job via toJob().
     * 2. Retrieves the Job's interval registry entry.
     * 3. Builds and returns a plain object describing interval state.
     *
     * Each interval entry includes:
     *   enabled  logical enable state
     *   on       current runtime state
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   A plain object keyed by interval name.
     *   Each value contains:
     *     enabled boolean
     *     on      boolean
     *
     *   Returns an empty object if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not expose internal interval definitions.
     * Does not expose repeat timing or pipeline configuration.
     * Does not validate registry integrity.
     */
    listJob(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return {};

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return {};

	const out = {};

	for (const [name, entry] of jobEntry.entries()) {
            out[name] = {
		enabled: !!entry.enabled,
		on: !!entry.on,
            };
	}

	return out;
    }

    /**
     * List Jobs that have registered interval definitions.
     *
     * CONTRACT
     * --------
     * listJobs() returns identifiers for all Jobs currently present
     * in the interval registry.
     *
     * It reflects registry membership only.
     * It does not indicate whether intervals are enabled or running.
     * It does not mutate controller state.
     *
     *
     * INPUT
     * -----
     * @param {boolean} [name=true]
     *   If true, returns Job names when available.
     *   If false, returns Job ids.
     *
     *
     * BEHAVIOR
     * --------
     * Iterates over all Job ids stored in the interval registry.
     *
     * If name is false:
     *   Returns the Job id for each entry.
     *
     * If name is true:
     *   Attempts to resolve the Job and return:
     *     job.name if present
     *     otherwise job.config.schema.name if present
     *     otherwise the Job id
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   An array of Job identifiers.
     *   Each entry corresponds to a Job that has at least one
     *   registered interval definition.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate Job existence beyond toJob resolution.
     * Does not expose interval configuration details.
     * Does not indicate runtime state.
     */
    listJobs(name = true) {
	const lib = this.lib;
	const out = [];

	for (const jobId of this.registry.keys()) {
            if (!name) {
		out.push(jobId);
		continue;
            }

            const job = this.toJob(jobId);

            // Prefer configured job name; fall back to id.
            const jobName =
		  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
		  null;

            out.push(jobName || jobId);
	}

	return out;
    }    
    
    /**
     * Activate interval timers for registered interval definitions.
     *
     * CONTRACT
     * --------
     * on() starts runtime interval timers for enabled interval entries.
     *
     * It does not execute pipelines directly.
     * It schedules timers through the injected interval service.
     * Pipeline execution is delegated to the Engine when ticks occur.
     *
     * Disabled intervals are never started.
     * Intervals that are already running are not duplicated.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, on() applies globally to all Jobs in the registry.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If provided and non-empty, only that interval name is targeted.
     *   If omitted or empty, all intervals for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to activate intervals for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its interval map from the registry.
     *
     * Interval selection
     *   If intervalName is provided, attempts to activate that single interval.
     *   Otherwise attempts to activate all registered intervals for the Job.
     *
     * Activation is delegated to the internal _onOne(job, name) helper.
     * _onOne is responsible for enforcing enable state and preventing duplicates.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval timers successfully activated.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May create runtime timers through the injected interval service.
     * May update registry runtime state for activated intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not change enable state.
     * Does not validate pipeline existence.
     * Does not enqueue pipelines directly.
     */
    on(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn on all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._onOne(job, intervalName);
	}

	// all intervals for job (only ones that are enabled will actually turn on)
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _onOne() is the internal activation primitive for a single interval entry.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use on() and off().
     *
     *
     * CONTRACT
     * --------
     * _onOne() attempts to start exactly one interval timer for a Job and interval name.
     *
     * It enforces all activation gates:
     *   Job must resolve and have an id
     *   intervalName must be a non-empty string
     *   interval entry must exist in the registry
     *   entry.enabled must be true
     *   entry.on must be false
     *   rec.repeat must be a finite number greater than zero
     *   rec.pipeline must be a non-empty string
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * RUNTIME BINDING
     * ---------------
     * A stable runtime identifier is computed as:
     *   at:jobId:intervalName
     *
     * This runtimeName is used as the key for the injected interval service.
     * It must remain stable so off() can reliably stop and unregister timers.
     *
     *
     * INTERVAL SERVICE CONTRACT
     * -------------------------
     * This method assumes AT.svc.interval provides:
     *   register({ name, everyMs, maxRuns, overlapPolicy, errorPolicy, fn })
     *   start(name)
     *
     * Overlap policy mapping:
     *   allowOverlap true  maps to overlapPolicy queue
     *   allowOverlap false maps to overlapPolicy coalesce
     *
     * Error policy mapping:
     *   onError stop  maps to errorPolicy pause
     *   otherwise     maps to errorPolicy continue
     *
     *
     * EXECUTION BOUNDARY
     * ------------------
     * The interval callback does not run pipelines directly.
     *
     * It enqueues work into the Engine:
     *   reason is interval
     *   intervalName is the logical key
     *   interval is the interval service context object
     *
     * The callback performs a scoped engine drain for the single ticket.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Registers a timer with the interval service.
     * Starts the timer immediately.
     * Mutates the registry entry runtime state:
     *   entry.on is set to true
     *   entry.runtimeName is set to the stable runtime identifier
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must remain deterministic and gate-driven.
     * It must not create duplicate timers for the same interval entry.
     * It must not mutate Job configuration.
     */
    _onOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// logical gate
	if (lib.bool.no(entry.enabled)) return 0;

	// already on
	if (lib.bool.yes(entry.on)) return 0;

	const rec = entry.def || {};

	const everyMs = Number(lib.hash.get(rec, "repeat") || 0);
	const maxRuns = Number(lib.hash.get(rec, "max") || 0) || 0;

	const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
	if (!pipeline) return 0;

	if (!Number.isFinite(everyMs) || everyMs <= 0) return 0;

	const allowOverlap = lib.bool.yes(lib.hash.get(rec, "allowOverlap"));
	const overlapPolicy = allowOverlap ? "queue" : "coalesce";

	const onError = lib.str.to(lib.hash.get(rec, "onError"), true).trim().toLowerCase();
	const errorPolicy = (onError === "stop") ? "pause" : "continue";

	// unique, stable runtime id for IntervalManager
	const runtimeName = `at:${job.id}:${intervalName}`;

	const engine = this.engine;
	const mgr = this.intervalManager;

	mgr.register({
            name: runtimeName,
            everyMs,
            maxRuns,
            overlapPolicy,
            errorPolicy,
            fn: (ctx) => {
		const ticket = engine.enqueue(job, pipeline, {
                    inputs: {
			reason: "interval",
			intervalName,
			interval: ctx,
                    },
                    meta: {
			source: "interval",
			intervalKey: intervalName,
			intervalName: runtimeName,
                    },
		});

		// scoped drain (only this ticket)
		engine.drain({ ticket });
            },
	});

	mgr.start(runtimeName);

	// mark runtime state
	entry.on = true;
	entry.runtimeName = runtimeName;

	return 1;
    }   

    /**
     * Deactivate interval timers for registered interval definitions.
     *
     * CONTRACT
     * --------
     * off() stops runtime interval timers previously activated by on().
     *
     * It does not execute pipelines.
     * It does not enqueue pipelines.
     * It does not modify enable state.
     *
     * Calling off() is safe even if the targeted interval is not running.
     * Intervals that are not running result in no action and contribute 0 to the count.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element|null} [jobLike]
     *   Optional Job-like reference resolved via toJob().
     *   If omitted or falsy, off() applies globally to all Jobs in the registry.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If provided and non-empty, only that interval name is targeted.
     *   If omitted or empty, all intervals for the resolved Job are targeted.
     *
     *
     * BEHAVIOR
     * --------
     * Global mode
     *   If jobLike is omitted, iterates over all Job ids in the registry and
     *   attempts to deactivate intervals for each resolved Job.
     *
     * Job mode
     *   Resolves the Job and retrieves its interval map from the registry.
     *
     * Interval selection
     *   If intervalName is provided, attempts to deactivate that single interval.
     *   Otherwise attempts to deactivate all registered intervals for the Job.
     *
     * Deactivation is delegated to the internal _offOne(job, name) helper.
     * _offOne is responsible for stopping the runtime timer and updating registry state.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {number}
     *   The number of interval timers successfully deactivated.
     *   Returns 0 if the Job cannot be resolved or has no registered intervals.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May stop runtime timers through the injected interval service.
     * May update registry runtime state for deactivated intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove interval definitions from the registry.
     * Does not change enable state.
     * Does not validate pipeline existence.
     */
    off(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn off all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.off(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._offOne(job, intervalName);
	}

	// all intervals for job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
	}

	return count;
    }

    /**
     * Developer note
     * --------------
     * _offOne() is the internal deactivation primitive for a single interval entry.
     *
     * This method is intentionally not part of the public API.
     * Public callers should use off() and remove().
     *
     *
     * CONTRACT
     * --------
     * _offOne() attempts to stop exactly one active interval timer for a Job and
     * interval name.
     *
     * It enforces all deactivation gates:
     *   Job must resolve and have an id
     *   intervalName must be a non-empty string
     *   interval entry must exist in the registry
     *   entry.on must be true
     *
     * If any gate fails, the method returns 0 and performs no side effects.
     *
     *
     * RUNTIME NAME RESOLUTION
     * -----------------------
     * The runtime identifier used by the interval service is resolved as:
     *   entry.runtimeName when present
     *   otherwise the computed fallback at:jobId:intervalName
     *
     * This stability guarantee ensures off() can cancel timers even if the entry
     * was partially reconstructed, as long as the naming scheme remains stable.
     *
     *
     * INTERVAL SERVICE CONTRACT
     * -------------------------
     * This method assumes the injected interval service provides:
     *   cancel(name)
     *
     * cancel() is treated as a full cancellation mechanism because on() registers
     * the interval definition before starting it.
     *
     *
     * SIDE EFFECTS
     * ------------
     * Cancels the runtime timer through the injected interval service.
     * Mutates the registry entry runtime state:
     *   entry.on is set to false
     *   entry.runtimeName is cleared
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * This method must not alter enable state.
     * This method must not remove registry entries.
     * This method must not enqueue or execute pipelines.
     */
    _offOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// already off
	if (lib.bool.no(entry.on)) return 0;

	// stable runtime name (prefer stored)
	const runtimeName = entry.runtimeName || `at:${job.id}:${intervalName}`;

	// runtime effect: fully cancel (since on() registers)
	this.intervalManager.cancel(runtimeName);

	// registry update
	entry.on = false;
	entry.runtimeName = null;

	return 1;
    }    

    /**
     * Logically enable interval definitions for a Job.
     *
     * CONTRACT
     * --------
     * enable() marks interval definitions as eligible to run.
     *
     * It does not start timers.
     * It does not enqueue pipelines.
     * It does not change runtime state.
     *
     * An enabled interval will only begin executing if on() is called.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If omitted or falsy, all intervals for the Job are enabled.
     *   If provided, only the specified interval is enabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its interval registry entry.
     *
     * If intervalName is omitted:
     *   Sets enabled to true for all interval entries of the Job.
     *
     * If intervalName is provided:
     *   Sets enabled to true for the specified interval entry.
     *
     * No runtime timers are started automatically.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one interval enable state was changed.
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *     the specified interval does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates the logical enable state in the internal registry.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not activate intervals.
     * Does not cancel running intervals.
     * Does not remove registry entries.
     * Does not mutate Job configuration.
     */
    enable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// enable ALL intervals for this job
	if (!intervalName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
		if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
		}
            }
            return changed;
	}

	// enable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	entry.enabled = true;
	return true;
    }    

    /**
     * Logically disable interval definitions for a Job.
     *
     * CONTRACT
     * --------
     * disable() marks interval definitions as ineligible to run.
     *
     * Disabling implies off.
     * If a targeted interval is currently running, it will be stopped.
     *
     * It does not enqueue pipelines.
     * It does not execute pipelines.
     *
     *
     * INPUT
     * -----
     * @param {Object|string|Element} jobLike
     *   Job-like reference resolved via toJob().
     *   The resolver must return a Job with a stable id.
     *
     * @param {string} [intervalName]
     *   Optional interval name selector.
     *   If omitted or falsy, all intervals for the Job are disabled.
     *   If provided, only the specified interval is disabled.
     *
     *
     * BEHAVIOR
     * --------
     * Resolves the Job and retrieves its interval registry entry.
     *
     * If intervalName is omitted:
     *   For each interval entry:
     *     Stops the interval if it is running.
     *     Sets enabled to false.
     *
     * If intervalName is provided:
     *   Stops the interval if it is running.
     *   Sets enabled to false.
     *
     * Runtime cancellation is performed via the internal _offOne() helper.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   Returns true if at least one interval changed state.
     *   A change includes:
     *     enabled changed from true to false
     *     a running interval was stopped
     *
     *   Returns false if:
     *     the Job cannot be resolved
     *     the Job has no registered intervals
     *     the specified interval does not exist
     *
     *
     * SIDE EFFECTS
     * ------------
     * May cancel running timers through the injected interval service.
     * Mutates the logical enable state in the internal registry.
     * Updates runtime state for stopped intervals.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not remove interval definitions from the registry.
     * Does not mutate Job configuration.
     * Does not validate pipeline existence.
     */
    disable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// disable ALL intervals for this job
	if (!intervalName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
		// runtime: if it's on, cancel it
		if (entry.on) this._offOne(job, name);

		// logical: disable
		if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
		} else if (entry.on) {
                    // (should already be false after _offOne, but counts as change)
                    changed = true;
		}
            }

            return changed;
	}

	// disable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	// runtime: if it's on, cancel it
	if (entry.on) this._offOne(job, intervalName);

	// logical: disable
	const wasEnabled = !!entry.enabled;
	entry.enabled = false;

	return wasEnabled || entry.on;
    }
    
}


export default Controller;


# --- end: class/interval/Controller.js ---



# --- begin: class/job/config/DomConfigSource.js ---

/**
 * DomConfigSource
 * ---------------
 *
 * Boundary adapter that extracts ActiveTags Job inputs from a DOM element.
 *
 * PURPOSE
 * -------
 * Reads DOM-provided configuration signals and produces a structured,
 * JSON-safe snapshot suitable for schema compilation.
 *
 * Responsibilities:
 *   - Capture selected element attributes.
 *   - Extract prefixed attributes (commonly data-*) into nested objects.
 *   - Resolve config bindings (e.g. data-config-at) into a concrete
 *     configuration object.
 *   - Merge DOM config with a provided defaultConfig overlay.
 *
 * This class does not validate schema correctness.
 * This class does not execute pipelines.
 * This class does not mutate Job or runtime state.
 *
 *
 * POSITION IN PIPELINE
 * --------------------
 * DomConfigSource is an input adapter used before Master.compile().
 *
 * Typical flow:
 *   1) Job.configure() calls:
 *        const src = new DomConfigSource({ lib, env, conf });
 *        const snap = await src.read(element, { defaultConfig });
 *   2) snap.output is passed into Master.compile().
 *
 *
 * READ CONTRACT
 * -------------
 * async read(source, { config_at, defaultConfig })
 *
 * - source
 *     DOM element to inspect.
 *
 * - config_at (optional)
 *     Attribute name used to locate configuration bindings.
 *     Defaults to conf.config.at.
 *
 * - defaultConfig (optional)
 *     Baseline configuration object layered beneath DOM-derived config.
 *
 * Returns:
 *   {
 *     report,     // exported Report shape
 *     dataSet,    // inflated prefixed attributes
 *     attrs,      // selected attribute snapshot
 *     at,         // normalized config binding reference(s)
 *     config,     // resolved config object (from DOM target)
 *     output      // merged { defaultConfig <- config <- dataSet }
 *   }
 *
 * The returned object is stable and JSON-safe.
 *
 *
 * CONFIG RESOLUTION
 * -----------------
 * Configuration bindings may resolve to:
 *   - Inline JSON payloads in DOM nodes
 *   - Script nodes (optionally gated eval)
 *   - Imported modules (optionally gated and allow-listed)
 *
 * All dynamic behavior is controlled by conf.config flags.
 * If disabled, resolution degrades safely and reports warnings.
 *
 *
 * SECURITY MODEL
 * --------------
 * - JSON parsing is the default resolution mechanism.
 * - Script evaluation is opt-in via conf.config.evalEnabled and
 *   restricted by allowed script types.
 * - Module imports are opt-in via conf.config.importEnabled and
 *   constrained by an allow-list path policy.
 * - Disallowed resource schemes are rejected.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain a pure input adapter.
 * Must not depend on Engine, Scheduler, or runtime execution state.
 * Must report issues via Report instead of throwing for user mistakes.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not compile pipelines.
 * Does not normalize schema blocks.
 * Does not perform final merge precedence beyond producing `output`.
 */

import Report from './Report.js';
// leave all constants presently as local, have to decide where to organize them later. (there are 2 constants files at moment.
import { ARR_TO_OPTS,  MERGE_OPTS_V1 } from '../../../constants.js';
const DEFAULT_EVAL_TYPE = "text/at-eval";
export default class DomConfigSource {
    /**
     * Create a new DomConfigSource instance.
     *
     * CONTRACT
     * --------
     * DomConfigSource requires an m7 lib instance, an ExpressionResolver,
     * and a configuration policy object. The instance is used to read DOM
     * attributes and resolve DOM-bound configuration targets into a
     * JSON-safe snapshot for schema compilation.
     *
     * This constructor performs dependency wiring and policy compilation only.
     * It does not read from the DOM.
     * It does not resolve config targets.
     * It does not mutate Job state.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Object} args.lib
     *   Required m7 lib instance.
     *
     * @param {Object} [args.env={}]
     *   Optional runtime environment context.
     *
     * @param {ExpressionResolver} args.expr
     *   Required expression and target resolver used to resolve config-at targets.
     *   This resolver is typically constructed by ActiveTags and injected here
     *   to avoid circular dependencies.
     *
     * @param {Object} args.conf
     *   Required configuration policy object controlling config resolution.
     *   Expected to include conf.config flags:
     *     evalEnabled, evalType
     *     importEnabled, importPath
     *
     * @param {boolean} [args.strict=false]
     *   Strict mode flag.
     *   When true, some invalid inputs may be treated as hard errors.
     *   When false, invalid inputs degrade safely and are reported via Report.
     *
     * @param {Job} [args.job]
     *   Optional Job reference used for diagnostics context only.
     *
     *
     * POLICY COMPILATION
     * ------------------
     * The constructor compiles resolution policy gates from conf.config:
     *   allowEvalConfig   enable or disable script evaluation
     *   allowEvalTypes    allowed script mime types for evaluation
     *   allowImportConfig enable or disable module import resolution
     *   allowImportPath   allow-list of permitted import path prefixes
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if lib is missing.
     * Throws if expr is missing.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate conf shape beyond required access.
     * Does not perform any DOM reads or config resolution.
     */
    constructor({ lib, env = {}, expr = null,strict = false,job,conf} = {}) {
        if (!lib) throw new Error("DomConfigSource: missing lib");
	if (!expr) throw new Error("DomConfigSource: missing expr");
        this.lib = lib;
	this.conf = conf;
        this.env = env;
        this.expr = expr;
	this.strict = lib.utils.isEmpty(strict) ? false : strict;
	this.job = job;

	this.allowEvalConfig = lib.bool.yes(conf.config.evalEnabled);
	this.allowEvalTypes  = lib.bool.no(conf.config.evalType) ? false : lib.array.to(conf.config.evalType);
	this.allowImportConfig = lib.bool.yes(conf.config.importEnabled) ;
	this.allowImportPath   = lib.array.to(conf.config.importPath);
    }

    /**
     * Produce an empty read() result shape.
     *
     * CONTRACT
     * --------
     * Returns a structurally valid snapshot object matching the shape
     * produced by read(), but containing no DOM-derived data.
     *
     * This helper ensures callers can rely on a consistent return contract
     * even when read() fails early or is short-circuited.
     *
     *
     * INPUT
     * -----
     * @param {Report} [report]
     *   Optional Report instance.
     *   If provided, its exported shape is included.
     *   If omitted, an empty Report export shape is used.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   {
     *     report,   // exported report shape
     *     dataSet,  // empty object
     *     attrs,    // empty object
     *     at,       // empty array of config bindings
     *     config,   // empty resolved config object
     *     output    // empty merged output object
     *   }
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * Must remain JSON-safe.
     * Must not perform DOM reads.
     * Must not mutate the provided Report instance.
     */
    static emptyReadShape(report){
	report = (report)?report.export() :  Report.emptyExportShape();
	return { report, dataSet:{}, attrs: {}, at : [], config: {}, output: {} };
    }

    /**
     * Read ActiveTags configuration inputs from a DOM element.
     *
     * CONTRACT
     * --------
     * read() extracts DOM-provided configuration signals and produces a
     * JSON-safe snapshot suitable for schema compilation.
     *
     * It captures:
     *   - prefixed attribute data (commonly data-*) inflated into nested objects
     *   - selected runtime attributes
     *   - config binding references (config-at)
     *   - resolved configuration object (from bound targets)
     *   - merged output object for schema compilation
     *
     * This method does not compile schema.
     * This method does not enqueue or execute pipelines.
     * This method does not mutate Job or runtime state.
     *
     *
     * INPUT
     * -----
     * @param {Element} source
     *   DOM element to inspect.
     *
     * @param {Object} [opts]
     *
     * @param {string|Array<string>} [opts.config_at=this.conf.config.at]
     *   Attribute name(s) used to locate configuration bindings.
     *   Values are read from the inflated dataset under these keys.
     *
     * @param {Object} [opts.defaultConfig={}]
     *   Baseline configuration layered beneath DOM-derived config.
     *   Used as the first merge layer for output.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Creates a new Report instance for diagnostics.
     * 2. Validates the source element.
     *    If invalid, returns emptyReadShape(report).
     * 3. Reads and inflates prefixed attributes into dataSet.
     * 4. Captures selected runtime attributes into attrs.
     * 5. Resolves config-at binding references into a normalized list (at).
     * 6. Resolves the bound configuration target(s) into a config object.
     * 7. Produces output by merging:
     *      defaultConfig <- config <- dataSet
     *    attrs are intentionally not merged into output.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   A JSON-safe snapshot with the shape:
     *     {
     *       report,   // exported report shape
     *       dataSet,  // inflated prefixed attributes
     *       attrs,    // selected runtime attributes
     *       at,       // normalized config binding reference list
     *       config,   // resolved config object
     *       output    // merged { defaultConfig <- config <- dataSet }
     *     }
     *
     *
     * ERROR HANDLING
     * --------------
     * Diagnostics are recorded into Report.
     * User configuration errors should not throw and instead degrade safely.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate schema correctness.
     * Does not apply final precedence layering beyond output merge.
     * Does not execute any runtime behavior.
     */
    async read(source,{config_at = this.conf.config.at, defaultConfig = {}} = {}){
	const lib = this.lib;
	const report = new Report({lib});

	//will assume for now that report will set ok=false  if errors.
	if (!this._assertElement({report, source}) )
	    return this.constructor.emptyReadShape(report);
        const dataSet = this._readDataset({report, source});
        const attrs   = this._readAttrs({report,source});
	const at      = this._getConfigAt({report, ds:dataSet, list:config_at});
	const config  = await this._resolveConfig({report, list:at,source});
	// attrs are runtime inputs, not config; intentionally not merged
	const output  = lib.hash.mergeMany([defaultConfig, config, dataSet],MERGE_OPTS_V1);
	return { report: report.export(), dataSet, attrs, at, config, output };
    }


    /**
     * Read and inflate prefixed attributes from a DOM element.
     *
     * CONTRACT
     * --------
     * _readDataset() extracts attributes whose names begin with configured
     * prefix strings and produces a nested, JSON-safe object.
     *
     * This method reads DOM attributes, not element.dataset.
     * It is commonly used for data-* style inputs, but the prefixes are
     * fully configurable.
     *
     *
     * PREFIX SEMANTICS
     * ----------------
     * - Iterates over conf.config.attrPrefixes in declared order.
     * - For each prefix:
     *     Selects attributes whose names start with the prefix.
     *     Strips the prefix from the attribute key.
     *     Inflates dashed keys into nested objects using "-" as delimiter.
     * - Results are merged in prefix order.
     *   Later prefixes override earlier prefixes on conflict.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read attributes from.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Nested object produced from prefixed attributes.
     *   Always returns a plain object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve config targets.
     * Does not validate schema correctness.
     * Does not interpret or coerce values beyond key normalization.
     */
    _readDataset({ report, source } = {}) {
	const lib = this.lib;

	const prefixes = lib.array.to(
            this.conf.config.attrPrefixes,
            ARR_TO_OPTS
	).filter(v => typeof v === "string");

	let out = {};

	for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            if (!prefix) continue;
            const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            const raw = lib.dom.filterAttributes(source, re, prefix.length) || {};

            const inflated = lib.hash.inflate(raw, { delim: "-" });
            const normalized = lib.hash.to(inflated);

            // merge in declared order (later prefixes override earlier ones)
            out = lib.hash.merge(out, normalized, MERGE_OPTS_V1);
	}

	return out;
    }
    
    
    /**
     * Capture selected element fields as runtime attributes.
     *
     * CONTRACT
     * --------
     * _readAttrs() captures a lightweight snapshot of selected fields from a
     * DOM element. These values are treated as runtime inputs and are not
     * merged into configuration output.
     *
     * Captured values may be re-read at runtime by other subsystems.
     * This method provides an initial snapshot for convenience and diagnostics.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read from.
     *
     * @param {string|Array<string>} [args.list=this.conf.config.capture_attrs]
     *   Field list describing which properties or attributes to capture.
     *   Each entry is passed to lib.dom.get(source, key).
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Plain object mapping each requested key to its captured value.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform schema compilation.
     * Does not resolve config bindings.
     * Does not apply merge precedence.
     */
    _readAttrs({ report, source, list = this.conf.config.capture_attrs } = {}) {
	const lib = this.lib;

	list = lib.array.to(list, ARR_TO_OPTS);

	const out = {};
	for (const item of list) {
            out[item] = lib.dom.get(source, item);
	}

	return out;
    }
    
    /**
     * Extract configuration binding references from an inflated dataset object.
     *
     * CONTRACT
     * --------
     * _getConfigAt() reads one or more dataset keys and returns a flat list of
     * configuration reference strings.
     *
     * It always returns an array.
     * It does not resolve references.
     * It does not validate references.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {*} [args.ds]
     *   Dataset-like object to read from.
     *   Coerced to an object via lib.hash.to().
     *
     * @param {*} [args.list]
     *   One or more dataset keys used to locate config references.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     *
     * BEHAVIOR
     * --------
     * - Iterates list in declared order.
     * - For each key:
     *     Reads ds[key]
     *     Coerces to string and trims
     *     Splits into tokens using lib.array.to(value, ARR_TO_OPTS)
     *     Appends all tokens to the result array
     *
     * Empty, missing, or non-string-coercible values are ignored.
     *
     * Ordering is preserved:
     *   list order determines lookup order
     *   split order is preserved within each value
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   Flat array of extracted reference strings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not apply priority or first-hit semantics.
     * Does not verify that extracted references exist.
     * Resolution occurs in _resolveConfig().
     */
    _getConfigAt({ ds, list } = {}) {
	const lib = this.lib;
	ds = lib.hash.to(ds);

	let at = [];
	list = lib.array.to(list, ARR_TO_OPTS);

	for (const loc of list) {
            const s = lib.str.to(lib.hash.get(ds, loc, ''), true).trim();
            if (!s) continue;
	    
            const items = lib.array.to(s, ARR_TO_OPTS);
            if (items.length) at.push(...items);
	}

	return at;
    }

    /**
     * Resolve config references into a single merged configuration object.
     *
     * CONTRACT
     * --------
     * _resolveConfig() resolves a list of configuration reference strings into
     * concrete configuration objects and merges them into a single snapshot.
     *
     * Resolution is performed sequentially and is order-sensitive.
     * Later references override earlier references on merge conflicts.
     *
     * This method may perform asynchronous resolution (imports, async loaders).
     * It does not compile schema.
     * It does not mutate Job or runtime state.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Diagnostics sink used to record resolution failures.
     *
     * @param {*} [args.list]
     *   List of configuration reference strings.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     * @param {Element} [args.source]
     *   DOM element used as interpolation or resolution context.
     *   Passed through to target resolution routines.
     *
     *
     * RESOLUTION POLICY
     * -----------------
     * - If list is empty or falsy, returns an empty object.
     * - Each non-empty ref is resolved via _resolveConfigTarget({ report, ref, source }).
     * - If a ref resolves to a non-object value:
     *     A diagnostic error is recorded to report.
     *     In strict mode, _error() may throw.
     *     In non-strict mode, the ref is skipped and resolution continues.
     *
     *
     * MERGE POLICY
     * ------------
     * Resolved objects are merged left-to-right:
     *   merged = merge(merged, resolvedRef, MERGE_OPTS_V1)
     *
     * Later refs override earlier refs.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   Merged configuration object.
     *   Returns {} when no references are provided or none resolve successfully.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate schema correctness.
     * Does not apply final precedence layering beyond ordered ref merge.
     * Does not interpret reference semantics beyond target resolution.
     */
    async _resolveConfig({ report, list, source } = {}) {
	const lib = this.lib;

	// 1) Nothing to resolve
	if (!lib.array.len(list)) return {};

	list = lib.array.to(list, ARR_TO_OPTS);

	let merged = {};

	for (let i = 0; i < list.length; i++) {
            const ref = lib.str.to(list[i], true).trim();
            if (!ref) continue;

            const conf = await this._resolveConfigTarget({ report, ref, source });
            if (!lib.hash.is(conf)) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_RESOLVE_FAILED",
                    `Config reference '${ref}' did not resolve to an object(hash)`,
                    { ref }
		);
		continue;
            }

            merged = lib.hash.merge(merged, conf, MERGE_OPTS_V1);
	}

	return merged;
    }

    /**
     * Resolve a single config reference into a configuration object.
     *
     * CONTRACT
     * --------
     * _resolveConfigTarget() resolves one config reference string into a plain
     * object suitable for merging into configuration.
     *
     * The reference may resolve to:
     *   - A plain object value
     *   - A DOM node containing an inline payload
     *   - A DOM node pointing to an external payload via data-src or src
     *   - An imported module reference (when enabled)
     *
     * If resolution fails, a diagnostic is recorded and {} is returned in
     * non-strict mode.
     * In strict mode, _error() may throw and the return path is not guaranteed.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Diagnostics sink for resolution failures.
     *
     * @param {string} args.ref
     *   Config reference string.
     *   May be a target expression or an import reference.
     *
     * @param {Element} args.source
     *   DOM element used as resolution context for expression evaluation and
     *   interpolation.
     *
     *
     * RESOLUTION FLOW
     * ---------------
     * 1. Normalize and validate ref.
     *    Empty refs produce an error and return {}.
     *
     * 2. Determine resolution strategy.
     *    - If the ref matches an import form, resolution is routed through
     *      _importConfig() subject to import policy.
     *    - Otherwise ref is evaluated through ExpressionResolver.
     *
     * 3. Reduce expression results.
     *    If the result is an { src, prop } pair, reads src[prop].
     *
     * 4. DOM payload handling.
     *    If the resolved value is a DOM element:
     *      - Prefer inline payload from textContent or innerText.
     *      - If inline payload is empty, optionally fetch external payload from
     *        data-src or src.
     *      - Parse the payload via _resolveDomConfigNode(), which applies the
     *        configured security policy (JSON, optional eval, etc).
     *
     * 5. Type enforcement.
     *    The final resolved value must be an object hash.
     *    Non-object values produce an error and return {}.
     *
     *
     * SECURITY AND POLICY
     * -------------------
     * - Import resolution is opt-in and constrained by allowImportConfig and
     *   allowImportPath policy.
     * - Script evaluation of DOM payloads is opt-in and constrained by
     *   allowEvalConfig and allowEvalTypes policy.
     * - Disallowed resource schemes and unsafe locations must be rejected by
     *   _maybeImport() and _resolveDomConfigNode().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   Resolved configuration object.
     *   Returns {} on failure in non-strict mode.
     *
     *
     * ERROR HANDLING
     * --------------
     * Records report errors for:
     *   - empty refs
     *   - import failures
     *   - expression evaluation failures
     *   - DOM payload empty or parse failures
     *   - resolved value not being an object
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not compile schema.
     * Does not merge multiple refs.
     * Does not execute runtime behavior.
     */
    async _resolveConfigTarget({ report, ref, source } = {}) {
	const lib = this.lib;

	ref = lib.str.to(ref, true).trim();
	if (!ref) {
            this._error(report, "configure", "CONFIG_REF_EMPTY", "Empty config reference");
            return {};
	}

	// Interpolate reference


	//console.log('ref' , ref);
	//const scheme = this.expr.interpScheme({ e: source }, undefined);
	//ref = lib.str.interp(ref, scheme);
	//console.log('after', ref);
	// Parse the target expression
	let info;
	//console.warn(ref);
	let imp = null;

	try {
	    imp = this._maybeImport(ref);

	    if (imp) {
		info = await this._importConfig(imp);
	    } else {
		info = this.expr.eval({ job: this.job }, ref);
	    }
	} catch (err) {
	    if (imp) {
		// import path failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_IMPORT_FAILED",
		    `Failed to import config reference '${ref}'`,
		    { error: err, ref, imp }
		);
	    } else {
		// expression / local reference failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_PARSE_TARGET_FAILED",
		    `Failed to parse config reference '${ref}'`,
		    { error: err, ref }
		);
	    }

	    return {};
	}
	//console.warn(info);
	// Evaluate into a value
	let val = info;

	if (!(lib.utils.isScalar(info) || lib.dom.is(info))) {
            if (lib.hash.is(info) && info.src && info.prop) {
		val = lib.hash.get(info.src, info.prop);
            } else {
		val = info;
            }
	}

	// DOM source => parse JSON from text
	if (lib.dom.is(val)) {

	    let text = "";

	    // Prefer inline JSON if present
	    const inline =
		  lib.str.to(val.textContent, true).trim() ||
		  lib.str.to(val.innerText, true).trim();
	    text = inline;
	    
	    // If inline is empty, try external source
	    if (lib.utils.isEmpty(inline)) {
		const src = val.getAttribute("data-src") || val.src;
		if (src) {
		    text = await fetch(src).then(r => r.text());
		}
	    } else {
		text = inline;
	    }
	    

            if (!text.trim()) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_DOM_EMPTY",
                    `Config DOM source for '${ref}' had no text`,
                    { ref }
		);
		return {};
            }

            try {
		//$FIXUP
		val = this._resolveDomConfigNode(val, text, { source, ref });
		//console.warn(val);
		//val = JSON.parse(text);
            } catch (err) {
		const msg = (err && err.message) ? String(err.message) : "Config parse failed";

		this._error(
		    report,
		    "configure",
		    "CONFIG_PAYLOAD_PARSE_FAILED",
		    `Config payload failed for '${ref}': ${msg}`,
		    { error: err, ref, type: val?.type, tagName: val?.tagName }
		);

		return {};
            }
	}

	// Must resolve to an object/hash
	if (!lib.hash.is(val)) {
            this._error(
		report,
		"configure",
		"CONFIG_NOT_OBJECT",
		`Config reference '${ref}' did not resolve to an object(hash)`,
		{ ref }
            );
            return {};
	}

	return val;
    }

    /**
     * Import a configuration module reference and return its exported value.
     *
     * CONTRACT
     * --------
     * _importConfig() resolves an import descriptor into a module export value.
     * Results are memoized so repeated imports of the same URL and export name
     * share a single in-flight Promise and cached resolution.
     *
     * Import base resolution is document-scoped.
     * Relative URLs are resolved against the owning document baseURI rather than
     * the current JavaScript module file location.
     *
     *
     * INPUT
     * -----
     * @param {Object} imp
     *   Import descriptor produced by _maybeImport().
     *   Expected fields:
     *     url        module URL (absolute or relative)
     *     exportName optional named export to read
     *
     *
     * BEHAVIOR
     * --------
     * 1. Initializes a per-instance import cache.
     * 2. Determines a document base URL using:
     *      this.importBaseUrl (if provided)
     *      job element ownerDocument.baseURI
     *      global document.baseURI (if available)
     * 3. Resolves imp.url against the document base when possible.
     * 4. Builds a stable cache key using resolvedUrl and exportName.
     * 5. If cached, returns the cached Promise.
     * 6. Otherwise performs a dynamic import of the resolved URL and returns:
     *      mod[exportName] when exportName is provided
     *      otherwise mod.default if present, else the module namespace object
     * 7. Stores the Promise in the cache and returns it.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<*>}
     *   Promise resolving to the imported export value.
     *
     *
     * SECURITY AND POLICY
     * -------------------
     * This method assumes import eligibility and path allow-list validation
     * have already been enforced by _maybeImport() and the caller.
     * It does not perform allow-list checks itself.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate the imported value type.
     * Does not coerce the imported export into an object.
     * Type enforcement occurs in _resolveConfigTarget().
     */
    async _importConfig(imp) {
	this._importCache ||= new Map();

	// Resolve relative imports against the DOCUMENT, not the module file.
	const docBase =
              this.importBaseUrl ||
              this.job?.e?.ownerDocument?.baseURI ||
              (typeof document !== "undefined" ? document.baseURI : "");

	const resolvedUrl = docBase
              ? new URL(imp.url, docBase).href
              : imp.url;

	const key = `${resolvedUrl}#${imp.exportName || ""}`;
	if (this._importCache.has(key)) return this._importCache.get(key);

	const p = (async () => {
            const mod = await import(/* @vite-ignore */ resolvedUrl);
            return imp.exportName ? mod[imp.exportName] : (mod.default ?? mod);
	})();

	this._importCache.set(key, p);
	return p;
    }
    

    /**
     * Parse and validate an import-style config reference.
     *
     * CONTRACT
     * --------
     * _maybeImport() recognizes import references of the form:
     *   "import:<url>[#<exportName>]"
     *
     * If the reference does not match the import form, returns null.
     * If the reference matches the import form, returns an import descriptor:
     *   { url, exportName }
     *
     * Import references are privileged.
     * When imports are disabled or blocked by policy, this method throws with
     * a structured error containing a stable code field.
     *
     *
     * INPUT
     * -----
     * @param {*} ref
     *   Candidate reference value.
     *   Non-string values return null.
     *
     *
     * IMPORT GRAMMAR
     * --------------
     * - Matches case-insensitively:
     *     import : <specifier>
     * - The specifier supports optional named export selection:
     *     <url>#<exportName>
     *
     * Examples:
     *   "import:/assets/config.js"
     *   "import:/assets/config.js#myExport"
     *
     *
     * POLICY GATES
     * ------------
     * 1. Global import enablement
     *    If allowImportConfig is false, throws CONFIG_IMPORT_DISABLED.
     *
     * 2. Scheme blocking
     *    URLs classified as resource schemes (data:, blob:, file:, extension schemes)
     *    are rejected with CONFIG_IMPORT_RESOURCE_BLOCKED.
     *
     * 3. Allow-list enforcement
     *    allowImportPath controls which external URLs may be imported.
     *
     *    - If allowImportPath is empty:
     *        Local-only mode.
     *        Only pathAbs and pathRel are allowed.
     *        External URLs are rejected with CONFIG_IMPORT_PATH_BLOCKED.
     *
     *    - If allowImportPath is non-empty:
     *        Local paths are always allowed.
     *        External URLs must resolve successfully and the resolved pathname
     *        must begin with one of the allowImportPath prefixes.
     *        Otherwise rejected with CONFIG_IMPORT_PATH_BLOCKED.
     *
     *
     * ERROR MODEL
     * -----------
     * Throws structured errors with Error.code set for:
     *   CONFIG_IMPORT_DISABLED
     *   CONFIG_IMPORT_EMPTY
     *   CONFIG_IMPORT_RESOURCE_BLOCKED
     *   CONFIG_IMPORT_URL_INVALID
     *   CONFIG_IMPORT_PATH_BLOCKED
     *
     * Callers are expected to catch and report these errors via Report.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object|null}
     *   null when ref is not an import reference.
     *   { url, exportName } when ref is a valid import reference.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform the dynamic import.
     * Does not validate imported value type.
     * Import execution is handled by _importConfig() and type enforcement
     * occurs in _resolveConfigTarget().
     */
    _maybeImport(ref) {
	const lib = this.lib;

	// Gate: imports are privileged.
	if (!this.allowImportConfig) {
            throw Object.assign(
		new Error(`Import config disabled for '${ref}'`),
		{ code: "CONFIG_IMPORT_DISABLED" }
            );
	}

	if (typeof ref !== "string") return null;

	const m = ref.match(/^\s*import\s*:\s*(.+?)\s*$/i);
	if (!m) return null;

	const spec = m[1];
	const [rawUrl, rawExport] = spec.split("#", 2);

	const url = (rawUrl || "").trim();
	const exportName = rawExport ? rawExport.trim() : null;

	if (!url) {
            throw Object.assign(
		new Error(`Empty import specifier in '${ref}'`),
		{ code: "CONFIG_IMPORT_EMPTY" }
            );
	}

	// Classify URL-ish type
	const t = lib.utils.linkType(url); // "pathAbs" | "pathRel" | "urlAbs" | "urlNet" | "resource" | ...

	// Block special schemes by default (data:, blob:, file:, chrome-extension:, etc.)
	if (t === "resource") {
            throw Object.assign(
		new Error(`Import blocked (resource scheme): '${url}'`),
		{ code: "CONFIG_IMPORT_RESOURCE_BLOCKED", url, linkType: t }
            );
	}

	// Normalize allow list (pathname prefixes)
	const allowList = (lib.array.filterStrings
			   ? lib.array.filterStrings(this.allowImportPath)
			   : lib.array.to(this.allowImportPath).filter(s => typeof s === "string" && s.trim())
			  ).map(s => String(s).trim()).filter(Boolean);

	// No allow list => local-only (pathAbs/pathRel only)
	if (!allowList.length) {
            const isLocal = (t === "pathAbs" || t === "pathRel");
            if (!isLocal) {
		throw Object.assign(
                    new Error(`Import blocked (local-only mode): '${url}'`),
                    { code: "CONFIG_IMPORT_PATH_BLOCKED", url, linkType: t }
		);
            }
            return { url, exportName };
	}

	// Allow local always
	if (t === "pathAbs" || t === "pathRel") {
            return { url, exportName };
	}

	// External (urlAbs/urlNet): require allowList pathname prefix match
	const base = this.env?.baseURI || this.env?.document?.baseURI || "";

	let resolved;
	try {
            resolved = new URL(url, base || undefined);
	} catch (err) {
            throw Object.assign(
		new Error(`Invalid import URL '${url}' in '${ref}'`),
		{ code: "CONFIG_IMPORT_URL_INVALID", url, error: err }
            );
	}

	if (!allowList.some(prefix => resolved.pathname.startsWith(prefix))) {
            throw Object.assign(
		new Error(`Import blocked by importPath: '${resolved.pathname}'`),
		{
                    code: "CONFIG_IMPORT_PATH_BLOCKED",
                    url,
                    pathname: resolved.pathname,
                    allowImportPath: allowList.slice(),
                    linkType: t,
		}
            );
	}

	return { url, exportName };
    }
    
    
    /**
     * Parse a DOM config payload into a configuration object.
     *
     * CONTRACT
     * --------
     * _resolveDomConfigNode() converts text content sourced from a DOM node
     * into a plain object configuration value.
     *
     * JSON parsing is the default behavior.
     * Script evaluation is supported only when explicitly enabled and only
     * for trusted SCRIPT nodes with an allowed type.
     *
     *
     * INPUT
     * -----
     * @param {Element} val
     *   DOM node that provided the payload text.
     *   Used to gate evaluation behavior (SCRIPT-only).
     *
     * @param {string} text
     *   Payload text to parse or evaluate.
     *
     * @param {Object} [ctx]
     *   Optional context object used for evaluation scope.
     *   May include:
     *     source  originating element used for resolution
     *     ref     config reference string being resolved
     *
     *
     * BEHAVIOR
     * --------
     * Default path
     *   Parses text as JSON using lib.json.parse when available, otherwise JSON.parse.
     *
     * Eval gating
     *   Evaluation is permitted only when all of the following are true:
     *     this.allowEvalConfig is true
     *     this.allowEvalTypes is provided
     *     val.tagName is SCRIPT
     *     val.type is an exact match for an allowed type
     *
     * If any gate fails, the JSON parse path is used.
     *
     * Eval path
     *   When permitted, evaluates the payload via Function constructor using
     *   a strict-mode wrapper and returns the evaluated result.
     *
     *   The evaluated payload must return an object.
     *   Non-object results throw an error.
     *
     *
     * EVALUATION SCOPE
     * ----------------
     * The eval path provides a single scope object containing:
     *   lib, job, source, ref
     *
     * The payload is evaluated with access to this scope object only.
     *
     *
     * SECURITY NOTES
     * --------------
     * - The eval path requires CSP support for unsafe-eval.
     * - Evaluation is opt-in and must remain gated by explicit config flags.
     * - This method does not attempt to sanitize or sandbox arbitrary code.
     *   It is intended for trusted pages only.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Parsed or evaluated configuration object.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws on JSON parse failure.
     * Throws on eval execution failure.
     * Throws if eval returns a non-object.
     */
    _resolveDomConfigNode(val, text, ctx = {}) {
	const lib = this.lib;
	//console.warn(val,text,ctx);
	// Default: JSON only
	const parseJSON = () => lib.json
              ? lib.json.parse(text)
              : JSON.parse(text);

	// Eval disabled → JSON only
	if (!this.allowEvalConfig || !this.allowEvalTypes) {
            return parseJSON();
	}

	// SCRIPT-only eval
	if (!val || String(val.tagName).toUpperCase() !== "SCRIPT") {
            return parseJSON();
	}

	// Exact type match (no substring hacks)
	const allowedTypes =
              lib.array.len(this.allowEvalTypes) 
              ? this.allowEvalTypes
              : [DEFAULT_EVAL_TYPE];

	const type = lib.str.to(val.type ,true).trim();
	if (!allowedTypes.includes(type)) {
            return parseJSON();
	}

	// ---- EVAL PATH (explicit, gated, scoped) ----
	// NOTE: requires CSP 'unsafe-eval'
	const scope = {
            lib,
            job: this.job,
            source: ctx.source,
            ref: ctx.ref,
	};

	const fn = new Function(
            "scope",
            `"use strict"; return (${text});`
	);

	const out = fn(scope);

	if (!out || typeof out !== "object") {
            throw new Error("Eval config source must return an object");
	}

	return out;
    }
    

    /**
     * Create a structured Error with standard metadata.
     *
     * CONTRACT
     * --------
     * _makeError() constructs an Error instance and attaches normalized
     * metadata fields used by Report and strict-mode error propagation.
     *
     * This helper does not throw.
     * Callers decide whether to throw or record the error.
     *
     *
     * INPUT
     * -----
     * @param {string} stage
     *   Logical stage name for the error source (e.g. "configure").
     *
     * @param {string} code
     *   Stable machine-readable error code.
     *
     * @param {string} message
     *   Human-readable error message.
     *
     * @param {Object} [meta={}]
     *   Optional metadata payload for debugging and diagnostics.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Error}
     *   Error instance with attached fields:
     *     err.stage
     *     err.code
     *     err.meta
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     */
    _makeError(stage, code, message, meta = {}) {
	const err = new Error(message);
	err.stage = stage;
	err.code = code;
	err.meta = meta;
	return err;
    }
    /**
     * Record an error to the Report and optionally throw in strict mode.
     *
     * CONTRACT
     * --------
     * _error() centralizes error reporting and strict-mode enforcement.
     *
     * Behavior:
     *   - Constructs a structured Error via _makeError().
     *   - Records the error into the provided Report instance when available.
     *   - Throws the Error only when this.strict is truthy.
     *   - Returns the Error instance when not thrown.
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Report instance used to collect diagnostics.
     *   May be null or undefined.
     *
     * @param {string} stage
     *   Logical stage identifier (e.g. "read", "configure", "resolve").
     *
     * @param {string} code
     *   Stable machine-readable error code.
     *
     * @param {string} message
     *   Human-readable description of the failure.
     *
     * @param {Object} [meta={}]
     *   Optional metadata payload for debugging and context.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Error}
     *   The constructed Error instance.
     *   In strict mode, this value is thrown instead of returned.
     *
     *
     * THROW POLICY
     * ------------
     * Throws only when this.strict is truthy.
     * In non-strict mode, execution continues and the error is reported.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not halt execution in non-strict mode.
     * Does not interpret error severity beyond strict-mode behavior.
     */
    _error(report, stage, code, message, meta = {}) {
	const err = this._makeError(stage, code, message, meta);

	if (report && typeof report.error === "function") {
            // path is optional; if you don’t have it, pass stage or code as the locator
            report.error(code, stage, message, meta);
	}

	if (this.strict) throw err;
	return err;
    }    

    /**
     * Validate that the provided source is a DOM element.
     *
     * CONTRACT
     * --------
     * _assertElement() verifies that source is present and DOM-like.
     *
     * If validation fails:
     *   - Records an error to the provided Report.
     *   - Throws only when this.strict is enabled.
     *   - Returns false in non-strict mode.
     *
     * Callers should treat a false return value as a fatal read condition.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Report instance used for diagnostics.
     *
     * @param {*} args.source
     *   Candidate DOM element to validate.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  when source is a valid DOM element.
     *   false when validation fails (non-strict mode).
     *
     *
     * THROW POLICY
     * ------------
     * Throws only when this.strict is truthy.
     * In non-strict mode, execution continues and the error is reported.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform schema validation.
     * Does not mutate state.
     */
    _assertElement({ report, source }) {
	const lib = this.lib;

	if (!source) {
            this._error(
		report,
		"read",
		"NO_ELEMENT",
		"Missing DOM source element"
            );
            return false;
	}

	if (!lib.dom.is(source)) {
            this._error(
		report,
		"read",
		"NOT_DOM",
		"Source is not a DOM element"
            );
            return false;
	}

	return true;
    }
}


# --- end: class/job/config/DomConfigSource.js ---



# --- begin: class/job/config/JobConfig.js ---

/**
 * JobConfig (v1) — Job-bound configuration compiler.
 *
 * ROLE IN THE SYSTEM
 * ------------------
 * JobConfig is the configuration nucleus of a Job.
 * It owns reading DOM inputs, resolving configuration references,
 * and compiling the normalized schema used by runtime subsystems.
 *
 *
 * HIGH-LEVEL PIPELINE (build)
 * ---------------------------
 * 1) Read DOM inputs
 *    - Delegates to DomConfigSource.read(source)
 *    - Produces a deterministic snapshot:
 *        { report, dataSet, attrs, at, config, output }
 *
 * 2) Compile normalized schema
 *    - Delegates to Schema(Master).compile(output)
 *    - Produces:
 *        { report, schema }
 *    - `schema` is groomed and ready for runtime consumption.
 *
 * No runtime artifact derivation is performed at this stage.
 *
 *
 * WHAT JOBCONFIG STORES (PUBLIC, STABLE)
 * ---------------------------------------
 * - this.inputs       : DOM/config read snapshot (DomConfigSource shape)
 * - this.schemaReport : exported schema compilation report
 * - this.schema       : canonical compiled schema used by runtime
 * - this.status       : JOB_CONFIG_STATUS.* lifecycle state
 * - this.error        : last thrown error (when applicable)
 * - this.name         : resolved job name from compiled schema
 *
 *
 * WHAT JOBCONFIG INTENTIONALLY DOES NOT DO
 * ----------------------------------------
 * - No scheduling decisions — handled by runtime controllers.
 * - No pipeline execution — handled by Engine / VM.
 * - No event or interval registration.
 * - No direct runtime mutation.
 *
 *
 * COERCION STANCE
 * ---------------
 * This layer is intentionally coercive and normalization-focused.
 * It produces stable shapes suitable for runtime.
 * Strict execution validation belongs to later phases.
 *
 *
 * ERROR AND REPORTING MODEL
 * --------------------------
 * - DOM read failures or schema compile failures transition status to ERROR.
 * - Report objects are exported snapshots and should not be mutated downstream.
 *
 *
 * LIFECYCLE NOTES
 * ---------------
 * - Safe to call `build()` multiple times; each call regenerates inputs and schema.
 * - JobConfig is job-bound and assumes a stable DOM element and ExpressionResolver.
 *
 *
 * SEE ALSO
 * --------
 * - DomConfigSource      DOM attribute and config-at resolution
 * - schema/Master        schema normalization and grooming
 * - Report               diagnostics container used during build
 */

import Schema          from './schema/Master.js';
import DomConfigSource from './DomConfigSource.js';
import freezeDeep      from '../../../helpers/freezeDeep.js';
import {JOB_CONFIG_STATUS} from '../../../constants.js';

export class JobConfig {

    /**
     * Create a JobConfig instance bound to a Job and its DOM source element.
     *
     * CONTRACT
     * --------
     * JobConfig is a job-scoped configuration compiler.
     * It owns:
     *   - reading DOM inputs and config bindings
     *   - resolving referenced configuration targets
     *   - compiling the normalized schema used by runtime subsystems
     *
     * This constructor performs dependency wiring only.
     * It does not read from the DOM.
     * It does not resolve config targets.
     * It does not compile schema.
     *
     *
     * INPUT
     * -----
     * @param {Object} opts
     *
     * @param {Object} opts.lib
     *   Required m7 lib instance used for coercion, hashing, DOM utilities,
     *   and merge semantics.
     *
     * @param {ExpressionResolver} opts.expr
     *   Required ExpressionResolver used to resolve config references.
     *
     * @param {Element} opts.e
     *   Required DOM element used as the configuration source root.
     *   All DOM reads and config-at resolution are relative to this element.
     *
     * @param {Job} opts.job
     *   Required owning Job instance.
     *   Used as a lifecycle anchor and for diagnostics context.
     *
     * @param {Object} opts.conf
     *   Required startup configuration policy used by DomConfigSource and schema
     *   compilation layers.
     *
     * @param {Object} [opts.env]
     *   Optional environment context (document hooks, baseURI, feature flags).
     *
     * @param {Object} [opts.ws]
     *   Optional shared workspace root used across config and runtime layers.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * - this.inputs       initialized to an empty DomConfigSource read shape
     * - this.schemaReport initialized to null
     * - this.schema       initialized to null
     * - this.status       initialized to JOB_CONFIG_STATUS.INIT
     * - this.error        initialized to null
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if any required dependency is missing:
     *   lib, expr, e, job, conf
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not execute pipelines.
     * Does not schedule work.
     * Does not derive stack or interval artifacts.
     */
    constructor(opts = {}) {
	if (!opts.lib)  throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e)    throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");
	if (!opts.job)  throw new Error("[Job] missing required option (opts.job)");
	if (!opts.conf)  throw new Error("[Job] missing required option (opts.conf)");
	
	const lib = opts.lib;
	this.startupConf = opts.conf;
	this.job = opts.job;
	this.env = opts.env; //root , document etc
	// core deps (config needs these)
	this.lib  = lib;
	this.expr = opts.expr;

	// DOM binding (config source root)
	this.e = opts.e;

	// persistent per-job workspace root (config/runtime shared)
	//this.ws = lib.hash.to(opts.ws);
	//this.allowedEvalTypes = opts.allowedEvalTypes;
	//this.allowEvalConfig  = opts.allowEvalConfig;
	// ---- configuration artifacts (kept tight) ----

	// snapshots from DOM/config resolution
	this.inputs = DomConfigSource.emptyReadShape();

	// compiled schema artifacts
	this.schemaReport = null; // exported Report
	this.schema       = null; // exported groomed schema


	// Reserved compatibility placeholders (not part of active v1 behavior).
	//this.artifacts = null;
	//this.artifactsBuilt = false;
	this.error = null;
	this.status = JOB_CONFIG_STATUS.INIT;
    }

    /**
     * Build or rebuild this Job configuration from its bound DOM element.
     *
     * CONTRACT
     * --------
     * build() is the primary configuration lifecycle entry point for a Job.
     * It performs a deterministic two-phase pass:
     *   1) Read DOM inputs and resolve config bindings into a merged output object
     *   2) Compile the merged output into a canonical schema
     *
     * Artifact derivation is intentionally out of scope for the current build path.
     *
     *
     * PIPELINE
     * --------
     * 1) Read inputs from the DOM (this.e)
     *    - Delegates to DomConfigSource.read()
     *    - Produces a stable snapshot:
     *        { report, dataSet, attrs, at, config, output }
     *
     * 2) Compile schema
     *    - Delegates to Schema.compile(output)
     *    - Produces:
     *        { report, schema }
     *
     * This method does not execute pipelines and does not schedule work.
     *
     *
     * FAILURE POLICY
     * --------------
     * - If DOM read report is not ok:
     *     status is set to JOB_CONFIG_STATUS.ERROR_DOM
     *     this.error is set to the exported read report
     *     build() returns ERROR_DOM
     *
     * - If schema compile report is not ok:
     *     status is set to JOB_CONFIG_STATUS.ERROR_SCHEMA
     *     this.error is set to the exported schema report
     *     build() returns ERROR_SCHEMA
     *
     * In either error state, the Job should be treated as not ready for execution.
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *   Optional options forwarded to DomConfigSource construction.
     *   This method currently performs a full rebuild each time and does not
     *   implement partial rebuild flags.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<number>}
     *   One of JOB_CONFIG_STATUS values indicating the resulting state:
     *     INIT, ERROR_DOM, ERROR_SCHEMA, READY
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates:
     *   - this.inputs
     *   - this.schemaReport
     *   - this.schema
     *   - this.name
     *   - this.status
     *   - this.error
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not derive stack or interval artifacts.
     * Does not enqueue or execute pipelines.
     * Does not register events or intervals.
     */
    async build(opts = {}){
	//---- read dom ----
	opts = this.lib.hash.to(opts);

	const domService = new DomConfigSource(
	    {
		...opts, env:this.env, conf:this.startupConf,
		lib:this.lib,expr:this.expr,job:this.job,
	    });
	const resp = await domService.read(this.e);
	this.inputs = resp;
	//immediately try to acquire a name
	this.name = this.lib.hash.getUntilNotEmpty(resp, "output.name dataset.name");
	if(!resp.report.ok) {
	    this.error = resp.report;
	    //console.error(this.error.errors[0]);
	    return this.status = JOB_CONFIG_STATUS.ERROR_DOM;
	}



	// --- coerce a schema from it ----
	const schemaService = new Schema({lib:this.lib,expr:this.expr});
	const schemaResp = schemaService.compile(resp.output);
	this.schemaReport = schemaResp.report;
	this.schema   = schemaResp.schema;

	if (!this.schemaReport.ok) {
	    this.error = this.schemaReport;
	    //console.error(this.error.errors[0]);
	    return  this.status   = JOB_CONFIG_STATUS.ERROR_SCHEMA;
	}
	// ---- finalize ----
	this.name     =  this.lib.utils.isEmpty(this.schema.name) ? 'unnamed job' : this.schema.name;
	//this._deriveArtifacts(opts);

	return this.status   = JOB_CONFIG_STATUS.READY;	
    }


    
    
}

export default JobConfig;


# --- end: class/job/config/JobConfig.js ---



# --- begin: class/job/config/JobConfig.removed.js ---

/**
 * ---------------------------------------------------------------------------
 * LEGACY / INACTIVE FILE - NOT USED BY ACTIVE TAGS RUNTIME
 * ---------------------------------------------------------------------------
 * @internal
 *
 * This file is retained for historical/reference purposes only.
 * It is not imported by the current runtime path and is not part of v1 execution.
 *
 * Maintenance policy:
 * - Do not treat this file as source of truth for current behavior.
 * - Do not use this file for user/public documentation generation.
 * - Prefer `JobConfig.js` and related active schema modules instead.
 * ---------------------------------------------------------------------------
 */

/* ------------------------------------------------------------
     * Private section methods 
     * ------------------------------------------------------------ */
    /**
     * Derive and freeze creation-time runtime artifacts.
     *
     * This method produces *creation-only* artifacts derived from the
     * already-compiled Job configuration. These artifacts are intended
     * for runtime consumption and must not be mutated after creation.
     *
     * Current behavior (v1.0):
     * - Acts as a coordination point for artifact derivation.
     * - Invokes optional derivation hooks if present.
     * - Freezes the resulting artifact object to prevent mutation.
     *
     * Design intent:
     * - Artifacts are built once per configuration lifecycle.
     * - Rebuilding is explicit and opt-in via `opts.rebuild`.
     * - Sub-derivation methods are intentionally stubbed and will be
     *   implemented incrementally as the runtime matures.
     *
     * Policy:
     * - If artifacts already exist and `opts.rebuild !== true`,
     *   this method is a no-op.
     *
     * Inputs:
     * - Prefers `this.schema` (normalized, groomed configuration).
     * - Falls back to an empty object if schema is not yet available.
     *
     * Side effects:
     * - Writes `this.artifacts` as a frozen object:
     *     {
     *       stackDefs,
     *       intervalDefs,
     *       pipelineDefs
     *     }
     * - Sets `this.artifactsBuilt = true`.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.rebuild]
     *     Force rebuilding artifacts even if already built.
     *
     * @returns {void}
     */
    _deriveArtifacts(opts = {}) {
	const lib = this.lib;
	const rebuild = !!opts.rebuild;

	// If already built and not rebuilding, do nothing.
	if (!rebuild && this.artifactsBuilt) return;

	// Prefer schema (groomed), fall back to conf (raw merged)
	const src = lib.hash.is(this.schema) ? this.schema : {};

	// ---- Derive stack defs
	let stackDefs;
	if (typeof opts.deriveStacks === "function") {
            stackDefs = opts.deriveStacks(this, src, opts);
	} else if (typeof this._deriveStackDefs === "function") {
            stackDefs = this._deriveStackDefs(src, opts);
	} else {
            stackDefs = {};
	}

	// ---- Derive interval defs
	let intervalDefs;
	if (typeof opts.deriveIntervals === "function") {
            intervalDefs = opts.deriveIntervals(this, src, opts);
	} else if (typeof this._deriveIntervalDefs === "function") {
            intervalDefs = this._deriveIntervalDefs(src, opts);
	} else {
            intervalDefs = {};
	}

	// ---- Derive pipeline defs
	let pipelineDefs;
	if (typeof opts.derivePipelines === "function") {
            pipelineDefs = opts.derivePipelines(this, src, opts);
	} else if (typeof this._derivePipelineDefs === "function") {
            pipelineDefs = this._derivePipelineDefs(src, opts);
	} else {
            pipelineDefs = {};
	}

	// Snapshot + freeze (creation-only)
	const artifacts = {
            stackDefs: stackDefs || {},
            intervalDefs: intervalDefs || {},
            pipelineDefs: pipelineDefs || {}
	};

	// deepCopy ensures caller hooks can't retain references; freeze prevents later mutation
	this.artifacts = freezeDeep(lib.hash.deepCopy(artifacts));
	this.artifactsBuilt = true;
    }

    /* ------------------------------------------------------------
     * Private derivation hooks (intentionally strict stubs for now)
     * ------------------------------------------------------------ */

    _deriveStackDefs(conf, opts = {}) {
	// TODO: derive stack definitions from conf (job-type archetypes, stacks, triggers, etc.)
	return {};
    }

    _deriveIntervalDefs(conf, opts = {}) {
	// TODO: derive interval definitions from conf (interval policies, named intervals, etc.)
	return {};
    }

    _derivePipelineDefs(conf, opts = {}) {
	// TODO: derive pipeline definitions from conf (pre/post chains, transforms, etc.)
	return {};
    }


# --- end: class/job/config/JobConfig.removed.js ---



# --- begin: class/job/config/Report.js ---

// class/schema/Report.js

/**
 * Report
 * ------
 * Structured compilation/normalization diagnostics for the ActiveTags schema compiler.
 *
 * Design intent:
 * - Small, explicit diagnostic object with a stable contract.
 * - Keeps Master/SchemeService clean: no "report is a random hash" leaking everywhere.
 * - Designed to be deep-copy/exportable and safe to attach to jobs.
 *
 * Contract:
 * - `errors` and `warnings` are append-only arrays of entries.
 * - `ok` is derived by default (errors.length === 0), but can be materialized via finalize().
 * - Never throws for consumer data issues; only for programmer misuse (missing lib).
 *
 * Entry shape:
 * { code: string, path: string, message: string, meta?: object }
 *
 * LLM integration notes:
 * - This class exists to stop the drift of ad-hoc report hashes.
 * - Keep the entry format stable (code/path/message/meta) so tools can parse it.
 * - Prefer coercion at the edges; Report should accept garbage-ish path/message and normalize.
 */

export default class Report {
    /**
     * @param {Object} args
     * @param {Object} args.lib - m7 lib instance
     */
    constructor({ lib }) {
        if (!lib) throw new Error("Report: missing lib");
        this.lib = lib;

        this.errors = [];
        this.warnings = [];

        // Optional materialized ok flag; if unset, ok() computes from errors.
        this._ok = null;
    }

    /**
     * Add an error entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    error(code, path, message, meta) {
        this.errors.push(this._entry(code, path, message, meta));
        this._ok = null; // invalidate materialized ok
        return this;
    }

    /**
     * Add a warning entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    warn(code, path, message, meta) {
        this.warnings.push(this._entry(code, path, message, meta));
        return this;
    }

    /**
     * True if there are no errors.
     * If finalize() has been called, returns the materialized value.
     *
     * @returns {boolean}
     */
    ok() {
        if (this._ok !== null) return this._ok;
        return this.errors.length === 0;
    }

    /**
     * Materialize ok flag and return it.
     * Useful if you want report.ok as a plain boolean snapshot.
     *
     * @returns {boolean}
     */
    finalize() {
        this._ok = (this.errors.length === 0);
        return this._ok;
    }

    /**
     * Merge another report into this one (append).
     *
     * Notes:
     * - Does not deep-copy entries by default; caller can export() if isolation is needed.
     *
     * @param {Report|Object} other
     * @returns {Report} this
     */
    merge(other) {
        const lib = this.lib;
        if (!other) return this;

        // Accept either a Report instance or a plain hash with errors/warnings.
        const o = (other instanceof Report) ? other : lib.hash.to(other);

        const errs = (o instanceof Report) ? o.errors : (lib.array.is(o.errors) ? o.errors : []);
        const warns = (o instanceof Report) ? o.warnings : (lib.array.is(o.warnings) ? o.warnings : []);

        for (let i = 0; i < errs.length; i++) this.errors.push(errs[i]);
        for (let i = 0; i < warns.length; i++) this.warnings.push(warns[i]);

        this._ok = null;
        return this;
    }

    /**
     * Export a plain JSON-safe report object.
     * Consumers can safely mutate the returned object.
     *
     * @returns {{ok:boolean, errors:Array, warnings:Array}}
     */
    export() {
        const lib = this.lib;

        // snapshot ok at export-time
        const out = {
            ok: this.ok(),
            errors: this.errors,
            warnings: this.warnings
        };

        return lib.utils.deepCopy(out);
    }
    static emptyExportShape(){
	return {
            ok       : null,
            errors   : [],
            warnings : []
	}
    }
    /**
     * Internal: normalize an entry into the stable shape.
     */
    _entry(code, path, message, meta) {
        const lib = this.lib;

        // Keep coercion simple and lib-native; don't over-validate.
        code = lib.str.to(code, true);
        path = lib.str.to(path, true);
        message = lib.str.to(message, true);

        const e = { code, path, message };

        if (lib.hash.is(meta)) e.meta = meta;
        return e;
    }
}


# --- end: class/job/config/Report.js ---



# --- begin: class/job/config/schema/constants.js ---

//arr_to_opts duplicated from the main constants...
export const ARR_TO_OPTS = {split:/\s+/,trim:true};

//request defaults.
export const INTERVAL = {
    RANGE_ERROR   : ['stop', 'continue'],
    RANGE_DEFAULT : "stop"
};
export const REQUEST = {
    TIMEOUT_DEFAULT : 10,
    METHODS         : ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'], 
    METHOD_DEFAULT  : "GET"
};
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
	aa: function (l, r) { return r; }, // array + array  => replace
	as: function (l, r) { return r; }  // array + scalar => overwrite
	// hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};

/**
 * Default Request Shape
 * ---------------------
 *
 * Canonical default configuration shape for a Job-level request definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the REQUEST block normalizer.
 * User-defined request entries are merged against this shape to ensure
 * consistent runtime expectations.
 *
 * This object defines structure only.
 * It does not perform network I/O.
 * It does not serialize bodies.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * url
 *   Request target URL.
 *   If undefined, may be resolved from form.action at submit time.
 *
 * method
 *   HTTP method.
 *   Defaults to REQUEST.METHOD_DEFAULT.
 *
 * encoding
 *   Body serialization strategy.
 *   Common values include:
 *     "urlencoded"
 *     "json"
 *     "formdata"
 *
 * body
 *   Payload content.
 *   Typically produced at submit time from form fields.
 *
 * headers
 *   HTTP headers object.
 *   Serializers may set Content-Type automatically.
 *
 * credentials
 *   Fetch credentials mode if applicable.
 *
 * timeoutMs
 *   Optional timeout in milliseconds.
 *
 * transport
 *   Optional transport override identifier.
 *   Allows alternative transport implementations.
 *
 * flags
 *   Serialization hints.
 *   json        indicates JSON encoding intent.
 *   urlencoded  indicates form-style encoding intent.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must remain transport-agnostic.
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */

export const DEFAULT_REQUEST_SHAPE = {
    url: undefined,          // filled from form.action if missing
    method: REQUEST.METHOD_DEFAULT,          // typical submit default (element may override)

    encoding: "urlencoded",  // typical form default (element.enctype may override)
    body: undefined,         // produced from form fields at submit-time

    headers: {},             // serializer may set Content-Type if needed
    credentials: undefined,

    timeoutMs: undefined,
    transport: undefined,
    
    flags: {
        json: undefined,
        urlencoded: true
    }
};

/**
 * Default Interval Shape
 * ----------------------
 *
 * Canonical default configuration shape for a Job-level interval definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the INTERVAL block normalizer.
 * User-defined interval entries are merged against this shape to ensure
 * predictable runtime semantics.
 *
 * This object defines logical configuration only.
 * It does not create timers.
 * It does not execute pipelines.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * enabled
 *   Master logical switch for the interval definition.
 *   If false, the interval will not be activated even if on() is called.
 *
 * autorun
 *   List of pipeline keys to enqueue during interval autorun.
 *   "__DEFAULT__" is resolved to the default pipeline at runtime.
 *
 * repeat
 *   Interval cadence in milliseconds.
 *   A value of 0 indicates the interval is not runnable until configured.
 *
 * max
 *   Maximum number of executions.
 *   A value of 0 indicates no execution limit.
 *
 * pipeline
 *   Pipeline key executed on each interval tick.
 *   Resolution and validation occur during runtime compilation.
 *
 * error
 *   Error handling policy.
 *   "stop"     pause interval on error
 *   "continue" keep interval running after error
 *
 * allowOverlap
 *   If true, a new execution may begin while a prior run is still active.
 *   If false, overlapping runs are prevented according to runtime policy.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must remain scheduler-agnostic.
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */
export const DEFAULT_INTERVAL_SHAPE = {
    // master switch for the interval definition
    enabled: true,

    // which pipelines to run on interval autorun (same selector semantics as enable.autorun)
    autorun: ["__DEFAULT__"],

    // scheduler config
    repeat: 0,          // ms; 0 means "not runnable until configured"
    max: 0,             // 0 means infinite
    pipeline: "initial",// default pipeline name (resolved/validated later)

    // runtime behavior
    error: "stop",    // "stop" | "continue"
    allowOverlap: false // allow a new run while the previous is still running
};

export const DEFAULT_PIPELINE_SHAPE = {
    run: [],                   // ops list (string|array coerced later)
    error: []                // ops list (string|array coerced later)
};
/**
 * Default Event Shape
 * -------------------
 *
 * Canonical default configuration shape for a Job-level event definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the EVENT block normalizer.
 * User-defined event entries are merged against this shape to ensure
 * consistent runtime expectations.
 *
 * This object defines logical event binding configuration only.
 * It does not install delegated handlers.
 * It does not execute pipelines.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * enabled
 *   Master logical switch for the event definition.
 *   If false, the binding will not be installed even if on() is called.
 *
 * event
 *   DOM event type string.
 *   Examples include click, submit, pointerover, pointerout.
 *   Normalization to delegator-safe equivalents may occur during compilation.
 *
 * selector
 *   Semantic trigger selector.
 *   Empty string or "__SELF__" indicates the Job root element itself.
 *   Non-empty values are treated as sub-delegation filters, not raw CSS
 *   attachment points.
 *
 * pipeline
 *   Pipeline key to enqueue when the event fires.
 *
 * options
 *   Event listener options passed to the delegator layer.
 *   capture  use capture phase if true
 *   passive  hint that the handler will not call preventDefault
 *   once     auto-remove after first invocation
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must remain delegator-agnostic.
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */

export const DEFAULT_EVENT_SHAPE = {
    // master switch for the event definition
    enabled: true,

    // DOM event type (pointerover, pointerout, click, submit, etc)
    event: "",

    // selector intent (NOT raw CSS semantics)
    // "" or "__SELF__" means “the job element itself”
    selector: "",

    // pipeline to enqueue when the event fires
    pipeline: "",

    // addEventListener options
    options: {
        capture: false,
        passive: true,
        once: false
    }
};

/**
 * Block Normalizer Specifications
 * --------------------------------
 *
 * Declarative configuration describing how each top-level schema block
 * should be normalized during Phase 1 compilation.
 *
 * PURPOSE
 * -------
 * BLOCK_NORMALIZERS provides metadata used by Master._normalizeBlock()
 * to apply consistent normalization logic across different configuration
 * sections such as request, interval, pipeline, and event.
 *
 * Each entry defines:
 *   - Input keys
 *   - Default merge shape
 *   - Optional hotkey coercion
 *   - Optional per-item handler
 *   - Output storage key
 *
 *
 * SPEC FIELD SEMANTICS
 * --------------------
 * single
 *   Singular block key in user configuration.
 *   Example: "request"
 *
 * plural
 *   Plural block key in user configuration.
 *   Example: "requests"
 *
 * default_shape
 *   Canonical default object merged into each block item.
 *
 * hotkey
 *   Optional shorthand key.
 *   If defined and the user supplies a scalar instead of an object,
 *   the value is coerced into an object under this key.
 *
 * user_shape
 *   Optional configuration key allowing users to override the default shape.
 *
 * handler
 *   Name of the Master instance method used for per-item normalization.
 *   If defined, each item is passed through this method after merging.
 *
 * outKey
 *   Internal storage key used to expose the effective normalized block.
 *   Typically prefixed with "_effective".
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This structure must remain declarative.
 * It must not contain executable logic.
 * It must not depend on runtime state.
 *
 * All behavioral semantics are implemented in Master._normalizeBlock().
 */

export const BLOCK_NORMALIZERS = {
    REQUEST: {
        single: "request",
        plural: "requests",
        default_shape: DEFAULT_REQUEST_SHAPE,
        hotkey: "url",
	user_shape: "request_shape",
        handler: "_normalizeRequestItem",
        outKey: "_effectiveRequests"
    },

    INTERVAL: {
        single: "interval",
        plural: "intervals",
        default_shape: DEFAULT_INTERVAL_SHAPE,
        hotkey: null,
	user_shape: "interval_shape",
        handler: "_normalizeIntervalItem",
        outKey: "_effectiveIntervals"
    },

    PIPELINE: {
        single: "pipeline",
        plural: "pipelines",
        default_shape: DEFAULT_PIPELINE_SHAPE,
        hotkey: null,
	user_shape: "pipeline_shape",
        handler: "_normalizePipelineItem",
        outKey: "_effectivePipelines"
    },

    EVENT: {
	single: "event",
	plural: "events",
	default_shape: DEFAULT_EVENT_SHAPE,
	hotkey: null,
	user_shape: "event_shape",
	handler: "_normalizeEventItem",
	outKey: "_effectiveEvents"
    }
};

export default {
    REQUEST, INTERVAL,
    MERGE_OPTS_V1,
    DEFAULT_REQUEST_SHAPE,
    DEFAULT_PIPELINE_SHAPE,
    DEFAULT_INTERVAL_SHAPE,
    DEFAULT_EVENT_SHAPE,
    BLOCK_NORMALIZERS,
    ARR_TO_OPTS
};


# --- end: class/job/config/schema/constants.js ---



# --- begin: class/job/config/schema/DSL.js ---

/**
 * Pipeline DSL Compiler
 * =====================
 *
 * PURPOSE
 * -------
 * Compiles normalized pipeline definitions into a canonical, runtime-ready
 * representation.
 *
 * This module is Phase 2 of Job configuration compilation.
 * It operates after structural normalization has completed and before
 * runtime execution begins.
 *
 *
 * POSITION IN COMPILATION PIPELINE
 * --------------------------------
 * Phase 1  Structural normalization
 *   - Coerce shapes
 *   - Apply defaults
 *   - Validate block structure
 *
 * Phase 2  DSL compilation  ← this module
 *   - Parse pipeline run and error definitions
 *   - Normalize into canonical list form
 *   - Prepare descriptors for runtime consumption
 *
 * Phase 3  Runtime execution
 *   - Engine and VM consume compiled pipeline definitions
 *
 *
 * INPUT CONTRACT
 * --------------
 * Expects:
 *   output.pipelines to be a hash of:
 *     pipelineName → pipelineObject
 *
 * Each pipelineObject may contain:
 *   run     string | array | mixed DSL form
 *   error   string | array | mixed DSL form
 *
 * Structural guarantees are assumed to be enforced upstream.
 *
 *
 * CURRENT BEHAVIOR
 * ----------------
 * - Coerces run and error blocks into canonical list form using
 *   ExpressionResolver.parseList().
 * - Mutates the provided output object in place.
 * - Ensures each pipeline object is aware of its own name.
 *
 *
 * FUTURE DIRECTION
 * ----------------
 * This module is the correct location for:
 *   - Descriptor compilation
 *   - AST construction
 *   - Static validation of operation shape
 *   - Compile-time diagnostics
 *
 * Runtime execution logic must never be placed here.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain deterministic.
 * Must not access Engine or runtime state.
 * Must not enqueue or execute pipelines.
 * Must not mutate configuration outside the pipelines block.
 *
 *
 * ERROR HANDLING
 * --------------
 * Diagnostics are reported via the provided Report instance.
 * This compiler should never throw for user configuration errors.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not execute pipelines.
 * Does not resolve Job instances.
 * Does not interpret descriptor semantics.
 */


import CONSTANTS from './constants.js';



export class DSL {

    /**
     * Create a new Pipeline DSL compiler instance.
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *   The m7 lib instance used for safe coercion and hash utilities.
     *
     * @param {ExpressionResolver} opts.expr
     *   An ExpressionResolver instance configured by the ActiveTags constructor.
     *   This resolver is used to parse run and error DSL blocks into canonical
     *   list form during compilation.
     *
     * This constructor performs dependency wiring only.
     * It does not execute compilation.
     */
    constructor({lib,expr}) {
	this.lib  = lib;
	this.expr = expr;
    }
    
    /**
     * Compile pipeline DSL for all pipeline definitions.
     *
     * CONTRACT
     * --------
     * _compilePipelineDSL() is a Phase 2 configuration compiler step.
     * It compiles pipeline run and error definitions from mixed DSL forms
     * into canonical, runtime-ready structures.
     *
     * This function is a wrapper over output.pipelines.
     * It does not execute pipelines.
     * It does not validate operation semantics beyond DSL parsing.
     *
     *
     * PRECONDITIONS
     * -------------
     * Phase 1 normalization must already have run for the pipelines block.
     * output.pipelines is expected to be a hash of:
     *   pipelineName -> pipelineObject
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Diagnostics sink used to record compilation issues.
     *
     * @param {Object} output
     *   Normalized configuration object.
     *   The object is coerced to a hash for safe access.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Coerces output to an object hash.
     * 2. Reads output.pipelines.
     * 3. If pipelines is not a hash, returns output unchanged.
     * 4. Iterates pipeline keys in deterministic order.
     * 5. For each pipeline object:
     *      Ensures p.name is set to the pipeline key for diagnostics.
     *      Invokes _compilePipelineDSLItem(report, p, { key }).
     *      Stores the compiled pipeline object back into pipelines[key].
     * 6. Writes pipelines back onto output and returns output.
     *
     *
     * MUTATION
     * --------
     * Mutates pipeline objects in place.
     * May also replace individual pipeline objects with the compiled result
     * returned by _compilePipelineDSLItem().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The same output reference when possible, containing compiled pipeline data.
     *
     *
     * ERROR HANDLING
     * --------------
     * User configuration errors should be reported to report.
     * This function should not throw for user DSL issues.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not access Engine or runtime state.
     * Does not interpret compiled descriptors at runtime.
     */
    _compilePipelineDSL(report, output) {
	const lib = this.lib;
	//console.log('here', lib.utils.deepCopy(output) );
	output = lib.hash.to(output);

	const pipelines = lib.hash.get(output, "pipelines");
	if (!lib.hash.is(pipelines)) return output;
	const keys = lib.hash.keys(pipelines);
	//console.log(keys);
	for (const key of keys) {

            const p = pipelines[key];
            if (!lib.hash.is(p)) continue;

            // Ensure pipeline item knows its own name (helps diagnostics)
            p.name = key;
            pipelines[key] = this._compilePipelineDSLItem(report, p, { key });
	}

	// Write back (in case output.pipelines was not the same reference)
	lib.hash.set(output, "pipelines", pipelines);

	return output;
    }

    /**
     * Compile a single pipeline definition into canonical DSL form.
     *
     * CONTRACT
     * --------
     * _compilePipelineDSLItem() transforms the run and error blocks of a
     * pipeline object into normalized list form using ExpressionResolver.
     *
     * It does not execute pipelines.
     * It does not validate operation semantics.
     * It does not construct execution descriptors or AST nodes.
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Diagnostics sink for compilation warnings or errors.
     *
     * @param {Object} p
     *   A single pipeline configuration object.
     *   Expected to contain run and optionally error definitions.
     *
     * @param {Object} [ctx]
     *   Optional compilation context.
     *   May include:
     *     key  pipeline name used for diagnostics.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Coerces p and ctx to safe object hashes.
     * 2. Normalizes p.run into canonical list form via expr.parseList().
     * 3. Normalizes p.error into canonical list form via expr.parseList().
     * 4. Returns the mutated pipeline object.
     *
     * Canonical list form ensures:
     *   - Strings, arrays, and mixed DSL inputs are converted into a
     *     consistent array structure.
     *   - Downstream runtime consumers can assume array semantics.
     *
     *
     * MUTATION
     * --------
     * Mutates the provided pipeline object in place.
     * Overwrites p.run and p.error with parsed list results.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The same pipeline object reference, containing normalized DSL fields.
     *
     *
     * FUTURE EXTENSION
     * ----------------
     * This method is the correct insertion point for:
     *   - AST descriptor construction
     *   - Static validation of operation shape
     *   - Compile-time diagnostics per pipeline step
     *
     * Additional compiled artifacts may be attached to p, such as:
     *   p.runAst
     *   p.errorAst
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not interact with Engine or VM.
     * Does not mutate configuration outside the provided pipeline object.
     */
    _compilePipelineDSLItem(report, p, ctx = {}) {
	const lib = this.lib;

	p = lib.hash.to(p);
	ctx = lib.hash.to(ctx);

	//console.log(`scrubbing pipeline ${ctx.key}`);
	
	p.run     = this.expr.parseList(p.run);
	p.error = this.expr.parseList(p.error);

	return p;
    }

}

export default DSL;


# --- end: class/job/config/schema/DSL.js ---



# --- begin: class/job/config/schema/Master.js ---

// class/schema/Master.js
/**
 * Master (Schema Compiler Workspace)
 * ---------------------------------
 * Schema compiler for ActiveTags configuration.
 *
 * Purpose:
 * - Accept an arbitrary "raw" ActiveTags config object (often derived from JSON,
 *   data-* attributes, and external merges).
 * - Coerce and normalize it into a groomed, runtime-ready schema.
 * - Emit a structured compilation report (warnings/errors) without throwing for
 *   user config mistakes.
 *
 * Public API:
 * - `compile(input) -> { report, schema }`
 *     - `report` is a JSON-safe object: `{ ok:boolean, errors:Array, warnings:Array }`
 *     - `schema` is the groomed runtime schema (safe for consumers to read and store).
 *
 * Design posture:
 * - Master is a *compiler workspace*, not a long-lived state container.
 * - Internal normalization may freely create intermediate artifacts on the
 *   local workspace object, but the exported schema is groomed and stable.
 * - Coercion is preferred over rejection: invalid/unknown values are normalized
 *   to safe defaults and recorded as warnings where appropriate.
 *
 * Normalization strategy (v1):
 * - Basics: `name`, `require`, `enabled`, `autorun`, `env`
 *   (Behavioral concerns such as confirmation are expressed explicitly via
 *   pipeline operations, not top-level schema keys.)
 *
 * - Buckets: normalize 4 block families using a shared procedure:
 *     - Requests:  `request` + `requests` + `request_shape`  -> `requests` bucket
 *     - Intervals: `interval` + `intervals` + `interval_shape` -> `intervals` bucket
 *     - Pipelines: `pipeline` + `pipelines` + `pipeline_shape` -> `pipelines` bucket
 *     - Events:    `event` + `events` + `event_shape`         -> `events` bucket
 *
 * - Each bucket item is produced as:
 *     `effectiveItem = merge(shape, item)`
 *   and then passed through an item normalizer.
 *
 * Stability notes:
 * - Internal workspace fields (for example `_effective*`) are compiler internals.
 * - External callers should consume only `{ schema, report }`.
 * - User config issues should be reported through `Report`; they are not hard throws.
 *
 * Versioning:
 * - This module defines Schema Compiler behavior for ActiveTags v1.
 */
import CONSTANTS from './constants.js';
import Report    from '../Report.js';
import DSL       from './DSL.js';
export default class Master {
    /**
     * Create a Master schema compiler workspace.
     *
     * Notes:
     * - This constructor does NOT compile, normalize, or validate user input.
     * - Master instances are lightweight and intended to be short-lived.
     * - All meaningful work happens in `compile(input)`.
     *
     * @param {Object} args
     *     Construction arguments.
     *
     * @param {Object} args.lib
     *     Required m7 lib instance providing hash/array/bool/utils helpers.
     *     Absence of `lib` is considered a programmer error.
     *
     * @param {Object} [args.env]
     *     Optional root environment context.
     *     Typically represents the document or root execution environment
     *     (e.g. `{ document, window, root }`), but is not required to be browser-bound.
     *     Reserved for future use (feature flags, document hooks, runtime bridges).
     *     Not currently consumed by the schema compiler in v1.
     *
     * @throws {Error}
     *     If `args.lib` is not provided.
     */
    constructor({ lib,  expr, env = {} }) {
	if (!lib) throw new Error("Master: missing lib");
	if(!expr) throw new Error("Master: missing expr");
	this.lib = lib;
	this.env = env;
	this.expr = expr;
	this.DSL = new DSL({lib,expr});
    }

    // ---------- public API ----------
    /**
     * Compile a raw ActiveTags configuration into a normalized runtime schema.
     *
     * Contract:
     * - This is the primary public entry point of the Master compiler.
     * - The function NEVER throws for user configuration errors.
     * - All diagnostics are recorded in the returned report object.
     *
     * Semantics:
     * - Input is coerced to a hash before processing.
     * - Normalization proceeds in deterministic phases:
     *     1) Basics (name, require, enabled, autorun, env)
     *     2) Block normalization (requests, intervals, pipelines, events)
     * - All intermediate artifacts remain internal and are not exposed.
     *
     * @param {*} input
     *     Raw user configuration.
     *     Typically derived from JSON, data-* attributes, or merged sources.
     *
     * @returns {Object}
     *     Compilation result.
     *
     * @returns {Object} return.report
     *     Exported compilation report:
     *     `{ ok:boolean, errors:Array, warnings:Array }`
     *
     * @returns {Object} return.schema
     *     Normalized, groomed runtime schema.
     *     Safe for consumers to read, store, and pass to runtime systems.
     *
     * Notes:
     * - Consumers MUST treat the returned schema as read-only.
     * - Behavioral concerns (e.g. confirmation) are expressed via pipelines,
     *   not top-level schema keys.
     * - Validation beyond basic normalization may occur in later phases.
     */
    compile(input){
        const output = this.lib.hash.to(input);
	const report = new Report({ lib: this.lib });
        this._normalizeBasics(report, output);    // name, selector, require, enable.autorun, confirm, etc.
        this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.REQUEST);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.INTERVAL);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.PIPELINE);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.EVENT);

	//work on the final shape rather than futz with artifacts
	const normalized =  this._exportShape(output);

	this.DSL._compilePipelineDSL(report, normalized);
        const rv =  {report:report.export(), schema: normalized };
	return rv;
	
    }

    /**
     * Produce the final exported runtime schema.
     *
     * Internal:
     * - Selects and grooms only consumer-relevant fields from the internal
     *   normalization workspace.
     * - Excludes intermediate and construction-only artifacts (raw input, shapes,
     *   temporary buckets, reports, etc.).
     *
     * Semantics:
     * - Buckets (`requests`, `intervals`, `pipelines`, `events`) are taken from their
     *   `_effective*` counterparts produced during normalization.
     * - Missing buckets are normalized to empty hashes (plain objects).
     * - Returned object is the canonical runtime schema for downstream consumers.
     *
     * Invariants:
     * - The returned schema is structurally stable and JSON-safe.
     * - Consumers must treat the schema as read-only.
     *
     * @param {Object} s
     *     Internal normalization workspace object.
     *
     * @returns {Object}
     *     Groomed runtime schema.
     *
     * @private
     */
    _exportShape(s) {
        const lib = this.lib;

        const out = {
            name      : s.name,
            require   : s.require,

            enabled   : s.enabled,
	    autorun   : s.autorun,
	    
            env       : s.env,

            requests  : lib.hash.to(s._effectiveRequests),
            intervals : lib.hash.to(s._effectiveIntervals),
	    pipelines : lib.hash.to(s._effectivePipelines),
	    events    : lib.hash.to(s._effectiveEvents)
        };

	return out;
    }

    
    // ---------- phase 1: normalize ----------
    /**
     * Normalize top-level, non-bucket schema fields.
     *
     * Internal:
     * - Handles scalar and small structural fields that do not participate
     *   in block/bucket normalization.
     * - Performs coercion-first normalization with warning-based diagnostics.
     * - Never throws for user configuration errors.
     *
     * Fields normalized here:
     * - `require` : string|array → array of tokens (split + trimmed)
     * - `name`    : coerced string (convenience identifier only)
     * - `enabled` : boolish → boolean (defaults true unless explicit "no" intent)
     * - `autorun` : canonical autorun selector list
     * - `env`     : object(hash) reserved for runtime user-space / root context
     *
     * Diagnostics:
     * - Invalid types are coerced to safe defaults.
     * - Non-fatal issues are recorded as warnings on the provided Report.
     *
     * Invariants after normalization:
     * - `s.require` is always an array
     * - `s.name` is always a string
     * - `s.enabled` is boolean
     * - `s.autorun` is an array
     * - `s.env` is always a hash
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {Object} s
     *     Internal normalization workspace object (mutated in place).
     *
     * @private
     */
    _normalizeBasics(report, s) {
        const lib = this.lib;

        // require: string|array -> array (split+trim)
        if (!lib.utils.baseType(s.require, "string array") && !lib.utils.isEmpty(s.require)) {
            report.warn("W101_REQUIRE_INVALID", "require", "require should be string|array");
        }
        s.require = lib.utils.baseType(s.require, "string array")
            ? lib.array.to(s.require, { split: /\s+/, trim: true })
            : [];

        // name: string coercion
        s.name = lib.str.to(s.name, true);
        // enable: hash coercion
	if (!lib.bool.ish(s.enabled)  && !lib.utils.isEmpty(s.enabled)) {
            report.warn("W102_ENABLE_INVALID", "enabled", "enabled should be boolish or undefined");
        }
	s.enabled = !lib.bool.no(s.enabled) ;
	s.autorun = this._normalizeAutorunSelector(report, s.autorun);

        // env: hash coercion
        if (!lib.hash.is(s.env) && !lib.utils.isEmpty(s.env)) {
            report.warn("W103_ENV_INVALID", "env", "env should be object(hash)");
        }
        s.env = lib.hash.to(s.env);
    }
    
    /**
     * Normalize a confirm descriptor into canonical form.
     *
     * Status:
     * - This helper is currently **not used** by the schema compiler.
     * - Confirm behavior in v1 is expressed explicitly via pipeline operations
     *   (e.g. `run: ["confirm", ...]`), not via top-level schema fields.
     * - This function is retained for potential future schema sugar or presets.
     *
     * Internal:
     * - Confirms are treated as a *policy hint*, not a strict validation target.
     * - Most inputs originate from inline attributes and are therefore strings.
     * - Coercion is preferred over rejection; invalid values degrade safely.
     *
     * Normalization rules:
     * - `null`, `undefined`, empty values → `{ mode: 'none' }`
     * - Boolean intent (including string intent):
     *     - yes  → `{ mode: 'default' }`
     *     - no   → `{ mode: 'none' }`
     * - Non-empty string → `{ mode: 'text', message: <string> }`
     * - Hash/object → merged with default confirm shape
     *
     * Diagnostics:
     * - Unsupported types are coerced to `{ mode: 'none' }`
     *   and recorded as a warning.
     *
     * Invariants after normalization:
     * - Always returns an object
     * - Returned object always has a `mode` field
     * - `message` is present only for text/advanced modes
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {*} val
     *     Raw confirm value supplied by the user.
     *
     * @param {string} [code="W301_CONFIRM_INVALID"]
     *     Warning code used when the value is invalid.
     *
     * @param {string} [path="confirm"]
     *     Schema path associated with the confirm value.
     *
     * @returns {Object}
     *     Canonical confirm descriptor.
     *
     * @private
     */
    _normalizeConfirm(report, val, code = "W301_CONFIRM_INVALID", path = "confirm") {
        const lib = this.lib;

        // null, undefined, empty, or whitespace-only strings → no confirm
        if (lib.utils.isEmpty(val) || (lib.str.is(val) && !val.trim()))
            return { mode: 'none' };

        // boolean intent (strings included)
        if (lib.bool.no(val))  return { mode: 'none' };
        if (lib.bool.yes(val)) return { mode: 'default' };

        // non-empty string → literal confirm message (unadulterated)
        if (lib.str.is(val)) {
            return { mode: "text", message: val };
        }

        // advanced / future form
        if (lib.hash.is(val))
            return lib.hash.merge({ mode: 'none', message: 'default message' }, val);

        report.warn(code, path, "confirm should be boolean|string|object(hash)");
        return { mode: 'none' };
    }

    /**
     * Normalize an autorun selector into canonical list form.
     *
     * Internal:
     * - Autorun selectors control which pipelines/stacks are triggered automatically.
     * - Inputs commonly originate from inline attributes and are therefore strings.
     * - Coercion is preferred over rejection; invalid values degrade safely.
     *
     * Normalization rules:
     * - Explicit "no" intent, `null`, empty, or whitespace-only strings → `[]` (no autorun)
     * - Explicit "yes" intent or `undefined` → `["__DEFAULT__"]`
     * - String or array → split (if string), trim, and filter into a token list
     * - Empty token list → `[]`
     *
     * Diagnostics:
     * - Unsupported types are coerced to default autorun behavior
     *   (`["__DEFAULT__"]`) and recorded as a warning.
     *
     * Invariants after normalization:
     * - Always returns an array
     * - Returned array contains only non-empty strings
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {*} v
     *     Raw autorun selector value supplied by the user.
     *
     * @param {string} [path="autorun"]
     *     Schema path associated with the autorun selector.
     *
     * @returns {Array<string>}
     *     Canonical autorun selector list.
     *
     * @private
     */
    _normalizeAutorunSelector(report, v, path = "autorun") {
        const lib = this.lib;

        // none
        if (lib.bool.no(v) || v === null || (lib.str.is(v) && !v.trim()))
            return [];

        // default set
        if (lib.bool.yes(v) || v === undefined)
            return ["__DEFAULT__"];

        // string|array -> list
        if (lib.utils.baseType(v, "string array")) {
            v = lib.array.to(v, { split: /\s+/, trim: true });
            v = v.filter(Boolean);
            if (v.length) return v;

            // empty result counts as none
            return [];
        }

        // invalid type -> warn + default
        report.warn("W201_AUTORUN_INVALID", path, "autorun should be boolean|string|array");
        return ["__DEFAULT__"];
    }

    /**
     * Normalize a block family (single + plural + shape) into an effective bucket.
     *
     * Purpose:
     * - Provide a single, reusable normalization procedure for all “bucket blocks”:
     *   requests, intervals, pipelines (and future block families).
     * - Resolve three layers into a canonical effective map:
     *   1) engine default shape (`default_shape`)
     *   2) consumer overlay shape (`user_shape`)
     *   3) per-entry user values (`single` and `plural` entries)
     *
     * Inputs:
     * - `s[single]`:
     *     Optional “lazy button” entry used to create `effective.default` only.
     *     If present and coercible, produces:
     *       effective.default = merge(blockShape, one, MERGE_OPTS_V1)
     *
     * - `s[plural]`:
     *     Optional hash of named entries.
     *     Each coercible entry produces:
     *       effective[name] = merge(blockShape, item, MERGE_OPTS_V1)
     *
     * - `default_shape`:
     *     Engine baseline contract for items in this block family.
     *     Must be a hash.
     *
     * - `user_shape`:
     *     Either:
     *       - a hash (used directly), OR
     *       - a string key to look up on `s` (e.g. "request_shape")
     *     If present, blockShape becomes:
     *       blockShape = merge(default_shape, user_shape, MERGE_OPTS_V1)
     *
     * - `hotkey`:
     *     Optional `lib.hash.to(x, hotkey)` hotkey for coercing scalar values
     *     into hashes (e.g. request url shorthand via hotkey "url").
     *
     * - `handler`:
     *     Optional item normalizer applied after merge.
     *     Resolved via `lib.func.get(handler, { root: this })` and called as:
     *       handler(mergedItem, ctx) -> normalizedItem
     *
     * Output:
     * - Writes `s[outKey]` as the canonical effective bucket map.
     *   Example keys:
     *     `_effectiveRequests`, `_effectiveIntervals`, `_effectivePipelines`
     *
     * Merge semantics:
     * - Uses `lib.hash.merge(left, right, CONSTANTS.MERGE_OPTS_V1)`.
     * - Merge is non-destructive (deep copies inputs).
     * - MERGE_OPTS_V1 overrides array behavior to replace (not concat).
     *
     * Context (`ctx`) passed to handlers:
     * - A stable context object is created for each item with:
     *     - `ctx.name`   : "default" or the named entry key
     *     - `ctx.kind`   : "default" | "named"
     *     - `ctx.key`    : `single` for default entries, `plural` for named entries
     *     - `ctx.single` / `ctx.plural` / `ctx.hotkey` / `ctx.outKey`
     *     - `ctx.report` : Report instance for warnings
     *
     * Notes:
     * - This function is intentionally coercive; it is not a strict validator.
     * - Empty hashes are allowed as valid items.
     * - Empty-ish strings (common from data-*) are treated as absent.
     * - Policy decisions about inheritance (e.g. whether named entries inherit the
     *   single/default entry) are made by the caller via shapes, not by this function.
     *
     * Side effects:
     * - Mutates `s` by writing `s[outKey]`.
     *
     * @param {Report} report
     *     Compilation report used to record warnings (threaded into ctx).
     *
     * @param {Object} s
     *     Internal normalization workspace object (mutated in place).
     *
     * @param {Object} spec
     *     Block normalization specification.
     *
     * @param {string} spec.single
     *     Name of the “lazy button” single entry key on `s` (e.g. "request").
     *
     * @param {string} spec.plural
     *     Name of the named-entry map key on `s` (e.g. "requests").
     *
     * @param {Object} spec.default_shape
     *     Engine default item shape for this block family.
     *
     * @param {Object|string} [spec.user_shape]
     *     User overlay shape, or a string key on `s` pointing to it.
     *
     * @param {string|null} [spec.hotkey]
     *     Optional hotkey for `lib.hash.to` coercion of scalar entries.
     *
     * @param {Function|string|null} [spec.handler]
     *     Optional item normalizer function (or method name on this instance).
     *
     * @param {string} spec.outKey
     *     Target key on `s` where the effective bucket will be stored.
     *
     * @returns {void}
     *
     * @private
     */
    // -----------------------------------------------------------------------------
    // Maintenance Notes / Invariants
    // -----------------------------------------------------------------------------
    // This function implements a generic, coercive normalization pattern used by
    // multiple block families (requests, intervals, pipelines).
    //
    // Design intent:
    // - This is NOT a validator. It normalizes shape and structure only.
    // - Coercion is preferred over rejection; invalid or empty-ish inputs are
    //   silently dropped unless a handler emits warnings.
    //
    // Key invariants (do not change lightly):
    // - `default_shape` is always the base layer for all effective items.
    // - `user_shape` may be:
    //     - a hash (used directly), or
    //     - a string key referencing a hash on the schema object.
    // - Empty hashes `{}` are valid and meaningful override values.
    //   Do NOT treat them as “trash” or auto-remove them.
    // - Empty-ish scalars (undefined, null, "", false) are treated as absent.
    //
    // Merge behavior:
    // - Uses `lib.hash.merge(left, right, CONSTANTS.MERGE_OPTS_V1)`.
    // - Merge is non-destructive (deep-copies inputs).
    // - Array semantics are overridden to REPLACE (not concat/push).
    //
    // Handler contract:
    // - If provided, `handler` is resolved via `lib.func.get`.
    // - Handler is invoked AFTER merge and may further normalize the item.
    // - Handler receives a stable `ctx` object including `report` for diagnostics.
    //
    // Warning / diagnostics policy:
    // - This function itself does not emit warnings.
    // - All diagnostics must be emitted by handlers or downstream normalizers.
    //
    // IMPORTANT:
    // - Block-specific policies (e.g. inheritance rules, validation requirements)
    //   belong in the block’s item normalizer or constants, NOT here.
    // -----------------------------------------------------------------------------
    

    _normalizeBlock(report, s, { single, plural, default_shape, user_shape, hotkey, handler, outKey }) {
        const lib = this.lib;

	const userShapeRef = lib.hash.is(user_shape)?user_shape : lib.hash.get(s,user_shape);
        const blockShape = lib.hash.is(userShapeRef)
              ? lib.hash.merge(default_shape, userShapeRef, CONSTANTS.MERGE_OPTS_V1)
              : default_shape;

	handler = lib.func.get(handler, {root:this});
        // single: lazy-button default only
        const one = lib.utils.baseType(s[single], hotkey ? "string object" : "object") && !lib.utils.isEmpty(s[single])
              ? lib.hash.to(s[single], hotkey)
              : null;

        const names = lib.hash.keys(s[plural]);

	const makeCtx = ({ name, kind, key }) => ({
	    name,
	    kind,
	    key,
	    single,
	    plural,
	    hotkey,
	    outKey,
	    report
	});
	
        const effective = {};

        // effective.default = shape + single
        if (lib.hash.is(one)) {
	    const ctx = makeCtx( { name: "default", kind: "default", key: single } );

            let v = lib.hash.merge(blockShape, one, CONSTANTS.MERGE_OPTS_V1);
            if (handler) v = handler.call(this, v, ctx);
            effective.default = v;
        }

        // effective[name] = shape + plural[name]
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const raw = s[plural][name];

            const item = lib.utils.baseType(raw, hotkey ? "string object" : "object") && !lib.utils.isEmpty(raw)
                  ? lib.hash.to(raw, hotkey)
                  : null;

            if (!lib.hash.is(item)) continue;

	    const ctx = makeCtx( { name, kind: "named",key: plural } );
            let v = lib.hash.merge(blockShape, item, CONSTANTS.MERGE_OPTS_V1);
            if (handler) v = handler.call(this, v, ctx);
            effective[name] = v;
        }

        s[outKey] = effective;
    }


    /**
     * Normalize a single interval definition.
     *
     * Internal:
     * - Intervals describe scheduled or repeating execution behavior.
     * - This phase performs structural normalization and intent coercion only.
     * - Scheduling semantics (timers, overlap behavior, lifecycle) are handled
     *   later by the scheduler/runtime.
     *
     * Responsibilities:
     * - Coerce the interval definition into hash form.
     * - Apply defaults and normalize boolean intent fields.
     * - Normalize autorun selectors using canonical rules.
     * - Coerce numeric repeat controls into a safe range.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(interval)`.
     * - `enabled` defaults to true unless explicit "no" intent.
     * - `autorun` is normalized via `_normalizeAutorunSelector`.
     * - `allowOverlap` is true only on explicit "yes" intent.
     * - `repeat` is coerced to int and clamped to `>= 0` (null max).
     *
     * Diagnostics:
     * - Invalid autorun values are recorded as warnings via Report.
     *
     * Invariants after normalization:
     * - Returned value is always a hash.
     * - `enabled` and `allowOverlap` are booleans.
     * - `autorun` is always an array.
     * - `repeat` is always a number (integer) `>= 0`.
     *
     * @param {Object} interval
     *     Raw interval definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.report` : Report instance
     *     - `ctx.name`   : interval name
     *     - `ctx.key`    : schema key path (e.g. "intervals")
     *
     * @returns {Object}
     *     Normalized interval definition.
     *
     * @private
     */
    _normalizeIntervalItem(interval,ctx) {
        const lib             = this.lib;

        interval              = lib.hash.to(interval);

	//default to true, but ignore legacy.
        interval.enabled      = !lib.bool.no(interval.enabled);
	interval.autorun      = this._normalizeAutorunSelector( ctx.report, interval.autorun, `${ctx.key}.${ctx.name}.autorun`);
        interval.allowOverlap = lib.bool.yes(interval.allowOverlap) ;
	interval.repeat       = lib.number.clamp ( lib.number.toInt(interval.repeat),0,null);
        return interval;
    }


    /**
     * Normalize a single request definition.
     *
     * Internal:
     * - Requests describe outbound I/O intent (HTTP or transport-like).
     * - This phase performs structural normalization and light coercion only.
     * - Transport semantics, body serialization, and execution behavior are
     *   handled later by the runtime/request layer.
     *
     * Responsibilities:
     * - Coerce the request into hash form using the configured hotkey.
     * - Normalize and clamp the HTTP method to an allowed set.
     * - Apply safe defaults for common request options.
     * - Coerce bag-style fields (`headers`, `flags`) into hashes.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(req, ctx.hotkey)`.
     * - `method` is uppercased and clamped to `CONSTANTS.REQUEST.METHODS`;
     *   invalid values fall back to `METHOD_DEFAULT`.
     * - `credentials` is true only on explicit "yes" intent.
     * - `timeoutMs` is coerced to a number, defaulting to
     *   `CONSTANTS.REQUEST.TIMEOUT_DEFAULT`.
     * - `headers` and `flags` are always hashes.
     *
     * Diagnostics:
     * - No hard validation is performed here.
     * - Invalid values degrade to safe defaults without warnings
     *   (method clamping is intentional and silent).
     *
     * Invariants after normalization:
     * - Returned value is always a hash.
     * - `method` is always an upper-case string.
     * - `credentials` is boolean.
     * - `timeoutMs` is always a number.
     * - `headers` and `flags` are hashes.
     *
     * @param {Object} req
     *     Raw request definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.hotkey` : key used to coerce scalar request definitions
     *     - `ctx.name`   : request name
     *     - `ctx.key`    : schema key path (e.g. "requests")
     *
     * @returns {Object}
     *     Normalized request definition.
     *
     * @private
     */
    _normalizeRequestItem(req,ctx) {
        const lib = this.lib;

        req = lib.hash.to(req, ctx.hotkey);

	// normalize + clamp HTTP method
	req.method = lib.utils.clamp(
	    CONSTANTS.REQUEST.METHODS,
	    lib.str.to(req.method, true).trim().toUpperCase(),
	    CONSTANTS.REQUEST.METHOD_DEFAULT
	).toUpperCase();

        // encoding/transport are free-form for now (future transports)
        // credentials: default false unless yes-intent
        req.credentials = lib.bool.yes(req.credentials);

        // timeoutMs: keep numeric if provided, else undefined
        req.timeoutMs = lib.utils.toNumber(req.timeoutMs,CONSTANTS.REQUEST.TIMEOUT_DEFAULT);

        // headers/flags/env-ish bags: coerce to hash
        req.headers = lib.hash.to(req.headers);
        req.flags = lib.hash.to(req.flags);

        return req;
    }

    /**
     * Normalize a single pipeline definition.
     *
     * Internal:
     * - Pipelines represent ordered execution chains.
     * - This phase performs only *structural normalization* and light intent coercion.
     * - Detailed parsing and execution semantics are handled in later phases.
     *
     * Responsibilities:
     * - Ensure presence of `run` and `error` keys.
     * - Normalize `enabled` (boolish intent) with safe defaults.
     * - Leave operation contents untouched for phase2 parsing.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(p)`.
     * - Missing `run`   → empty array.
     * - Missing `error` → empty array.
     * - `enabled` defaults to true unless explicit "no" intent.
     *
     * Diagnostics:
     * - Non-boolish `enabled` values are recorded as warnings via Report.
     *
     * Invariants after normalization:
     * - Returned object is always a hash.
     * - `run` and `error` keys always exist and are arrays.
     * - `enabled` is boolean.
     * - No validation or mutation of individual operations occurs here.
     *
     * @param {Object} p
     *     Raw pipeline definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.report` : Report instance
     *     - `ctx.name`   : pipeline name
     *     - `ctx.key`    : schema key path (e.g. "pipelines")
     *
     * @returns {Object}
     *     Normalized pipeline definition.
     *
     * @private
     */
    _normalizePipelineItem(p, ctx) {
        const lib = this.lib;

        p = lib.hash.to(p);
        if (!('run' in p)) p.run = [];
        if (!('error' in p)) p.error = [];
	if (!lib.bool.ish(p.enabled)  && !lib.utils.isEmpty(p.enabled)) {
            ctx.report.warn("W102_ENABLE_INVALID", "enabled", `enabled should be boolish or undefined for ${ctx.name}.enabled (default true)`);
        }
        p.enabled = lib.bool.no(p.enabled) ? false:true;
        return p;
    }

    /**
     * Normalize a single event binding definition.
     *
     * Internal:
     * - Events describe declarative bindings between DOM (or env) events and pipelines.
     * - This phase performs structural normalization and light intent coercion only.
     * - Event dispatch semantics and listener lifecycle are handled at runtime.
     *
     * Responsibilities:
     * - Coerce the event definition into hash form.
     * - Normalize basic intent fields (`enabled`, `event`, `pipeline`).
     * - Apply safe defaults for selector targeting.
     * - Normalize addEventListener-style options.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(ev)`.
     * - `enabled` defaults to true unless explicit "no" intent.
     * - `event` is coerced to a lower-case string.
     * - `pipeline` is coerced to a string identifier.
     * - `selector` is kept as a string; empty values default to `"__SELF__"`.
     *   (Sentinel value interpreted by the ActiveTags runtime, not a CSS selector.)
     * - `options` is coerced to a hash and normalized as addEventListener flags:
     *     - `capture`, `passive`, `once` are true only on explicit "yes" intent.
     *
     * Diagnostics:
     * - No hard validation is performed here.
     * - Invalid or missing values degrade to safe defaults without warnings.
     *
     * Invariants after normalization:
     * - Returned value is always a hash.
     * - `enabled` is boolean.
     * - `event`, `pipeline`, and `selector` are non-empty strings.
     * - `options` is always a hash with boolean flags.
     *
     * @param {Object} ev
     *     Raw event definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.report` : Report instance (not currently used here)
     *     - `ctx.name`   : event name
     *     - `ctx.key`    : schema key path (e.g. "events")
     *
     * @returns {Object}
     *     Normalized event definition.
     *
     * @private
     */
    _normalizeEventItem(ev, ctx) {
	const lib = this.lib;

	ev = lib.hash.to(ev);

	// default to enabled=true unless explicit "no"
	ev.enabled = !lib.bool.no(ev.enabled);

	// event type: required-ish, canonical lower-case string
	ev.event = lib.str.to(ev.event, true).trim().toLowerCase();

	// pipeline: required-ish
	ev.pipeline = lib.str.to(ev.pipeline, true).trim();

	// selector: keep as string; empty -> default (runtime can treat as self)
	// For now we keep this very light, because selector semantics are runtime-defined.
	ev.selector = lib.str.to(ev.selector, true).trim();
	if (!ev.selector) ev.selector = "__SELF__"; // sentinel; NOT CSS (AT runtime interprets)

	// options: addEventListener-ish bag
	ev.options = lib.hash.to(ev.options);
	ev.options.capture = lib.bool.yes(ev.options.capture);
	ev.options.passive = lib.bool.yes(ev.options.passive);
	ev.options.once    = lib.bool.yes(ev.options.once);

	return ev;
    }
    
    // ---------- phase 2: validate ----------
    // unimplimented at this time. may not be necessary.
}


/**
 * @typedef {Object} CompileResult
 * @property {CompileReport} report
 *     Exported compilation report.
 *
 * @property {Object} schema
 *     Normalized, groomed runtime schema.
 *     Safe for consumers to read, store, and pass to runtime systems.
 */

/**
 * @typedef {Object} CompileReport
 * @property {boolean} ok
 * @property {Array<Object>} errors
 * @property {Array<Object>} warnings
 */

/**
 * @typedef {Object} BlockNormalizerSpec
 *
 * Specification object passed to `_normalizeBlock`.
 *
 * @property {string} single
 *     Key on the schema object representing the “lazy button” single entry
 *     (e.g. `"request"`, `"interval"`, `"pipeline"`, `"event"`).
 *
 * @property {string} plural
 *     Key on the schema object representing the named-entry map
 *     (e.g. `"requests"`, `"intervals"`, `"pipelines"`, `"events"`).
 *
 * @property {Object} default_shape
 *     Engine baseline shape for items in this block family.
 *
 * @property {Object|string} [user_shape]
 *     Optional user-provided shape overlay.
 *     Either:
 *       - a hash, or
 *       - a string key referencing a hash on the schema object.
 *
 * @property {string} [hotkey]
 *     Optional hotkey used by `lib.hash.to(value, hotkey)` to coerce
 *     scalar entries into hashes.
 *
 * @property {Function|string} [handler]
 *     Optional item normalizer applied after merge.
 *     May be a function reference or the name of a method on `Master`.
 *
 * @property {string} outKey
 *     Target key on the schema object where the effective bucket
 *     will be written (e.g. `"_effectiveRequests"`).
 */

/**
 * @typedef {Object} BlockItemContext
 *
 * Context object passed to block item normalizers.
 *
 * @property {string} name
 *     Item name.
 *     `"default"` for single-entry items, or the key name for named entries.
 *
 * @property {"default"|"named"} kind
 *     Indicates whether the item originated from the single or plural source.
 *
 * @property {string} key
 *     Source schema key for this item (either `spec.single` or `spec.plural`).
 *
 * @property {string} single
 *     Name of the single-entry key for this block family.
 *
 * @property {string} plural
 *     Name of the plural-entry key for this block family.
 *
 * @property {string} [hotkey]
 *     Hotkey used for scalar coercion, if any.
 *
 * @property {string} outKey
 *     Name of the effective bucket key being produced.
 *
 * @property {Report} report
 *     Compilation report instance used for warnings and diagnostics.
 */


# --- end: class/job/config/schema/Master.js ---



# --- begin: class/job/Job.js ---

/**
 * Job
 * ===
 *
 * Persistent runtime binding to a single DOM element, with stable identity
 * and delegated configuration.
 *
 *
 * CORE IDEA
 * ---------
 * A Job is an identity + lifecycle container.
 *
 * It owns:
 *   - Stable identity (id, createdAt)
 *   - DOM anchor (e)
 *   - Runtime lifecycle state (status, flags)
 *   - Ephemeral run state (run)
 *
 * It delegates all configuration logic to JobConfig.
 *
 *
 * RESPONSIBILITIES
 * ----------------
 * - Hold stable identity assigned at registration time.
 * - Anchor to a DOM element for lookup and lifecycle management.
 * - Manage runtime lifecycle state (attached/detached, status transitions).
 * - Provide a thin configuration entry point via configure().
 * - Expose convenience accessors (name) backed by compiled schema.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * - DOM extraction and config resolution (handled by JobConfig).
 * - Schema normalization and grooming (handled by schema/Master).
 * - Scheduling policy (handled by Engine/registry layer).
 * - Execution semantics (handled by Engine / VM).
 *
 *
 * IDENTITY MODEL
 * --------------
 * - id is the true unique identifier.
 * - name is a convenience identifier derived from configuration.
 *   It is not guaranteed to be unique.
 *
 *
 * LIFECYCLE MODEL
 * ---------------
 * - detach() marks the job as no longer attached to its DOM element.
 * - shutdown() is the controlled teardown entry point.
 * - beginRun() and endRun() manage ephemeral per-run metadata.
 *
 *
 * INVARIANTS
 * ----------
 * - job.e must be a DOM element for the Job to be considered attachable.
 * - A Job may exist before configuration is successfully built.
 * - Configuration state is isolated within job.config.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Job must remain thin.
 * Job must not duplicate configuration logic.
 * Job must not execute pipelines directly.
 */
import JobConfig from './config/JobConfig.js';
import { JOB_CONFIG_STATUS, JOB_STATUS, JOB_TYPE } from '../../constants.js';

export default class Job {

    /**
     * Construct a new Job instance.
     *
     * CONTRACT
     * --------
     * The Job constructor is intentionally thin.
     * It establishes identity, core dependencies, and lifecycle state only.
     * All configuration concerns are delegated to job.config (JobConfig).
     *
     * A Job is a stable runtime container bound to a DOM element.
     * Configuration may be built or rebuilt independently of Job identity.
     *
     *
     * REQUIRED INVARIANTS
     * -------------------
     * - opts.lib is required and must be a valid m7 lib instance.
     * - opts.expr is required and must be an ExpressionResolver instance.
     * - opts.e is required and must be a DOM element.
     * - opts.env is required and supplies the runtime environment context.
     * - opts.conf is required and supplies configuration policy defaults.
     *
     *
     * IDENTITY MODEL
     * --------------
     * - id is the true unique identifier.
     *   It may be assigned at registration time or later by the registry layer.
     * - name is a convenience label and is not guaranteed unique.
     *   The canonical name is typically derived from configuration after build.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * - this.e        DOM binding (identity anchor)
     * - this.id       optional unique identifier
     * - this.createdAt creation timestamp (defaults to now)
     * - this.config   JobConfig instance (delegated configuration compiler)
     * - this.ws       per-job workspace hash
     * - this.status   initial lifecycle status
     * - this.error    last runtime error (null initially)
     * - this.run      per-run state record (null initially)
     * - this.flags    lifecycle flags (attached, hasRun, dirty)
     *
     *
     * INPUT
     * -----
     * @param {Object} opts
     *
     * @param {Object} opts.lib
     *   Required m7 utility library.
     *
     * @param {ExpressionResolver} opts.expr
     *   Required expression resolver used by configuration resolution.
     *
     * @param {Element} opts.e
     *   Required DOM element this Job is bound to.
     *
     * @param {Object} opts.env
     *   Required environment context (document, baseURI, hooks).
     *
     * @param {Object} opts.conf
     *   Required configuration policy object for JobConfig.
     *
     * @param {string|null} [opts.id]
     *   Optional unique Job identifier.
     *
     * @param {number} [opts.createdAt=Date.now()]
     *   Optional creation timestamp.
     *
     * @param {string|null} [opts.name]
     *   Optional logical name override.
     *
     * @param {string} [opts.status=JOB_STATUS.READY]
     *   Optional initial lifecycle status.
     *
     * @param {Object} [opts.ws]
     *   Optional per-job workspace object shared across subsystems.
     *
     * @param {Object} [opts.flags]
     *   Optional initial lifecycle flags merged onto defaults.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if any required dependency is missing:
     *   lib, expr, e, env, conf
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not read DOM inputs.
     * Does not resolve config references.
     * Does not compile schema.
     * Does not enqueue or execute pipelines.
     */
    constructor(opts = {}) {

	if (!opts?.lib) throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e)    throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");
	if (!opts.env)  throw new Error("[Job] missing required option (opts.env)");
	if (!opts.conf) throw new Error("[Job] missing required option (opts.conf)");
	const lib = opts.lib;
	opts = lib.hash.to(opts);

	this.opts = opts;
	// ---- core dependencies ----
	this.lib  = lib;
	this.expr = opts.expr;

	// ---- DOM binding ----
	// The element this job is bound to (identity anchor for Scheduler)
	this.e = opts.e;

	// ---- identity (scheduler-owned, may be assigned later) ----
	this.id        = lib.hash.get(opts, "id", null);
	this.createdAt = lib.hash.get(opts, "createdAt", Date.now());


	// ---- configuration (fully delegated) ----
	this.config = new JobConfig({
            lib,
	    conf      : opts.conf,
            expr      : opts.expr,
            e         : opts.e,
            job       : this,
	    env       : opts.env
	});
	
	// ---- optional logical name (not guaranteed unique) ----
	this.setName( lib.hash.get(opts, "name", null) );

	// ---- persistent job workspace ----
	// Used by runtime, pipelines, and user extensions
	this.ws = lib.hash.to(opts.ws);

	// ---- lifecycle / execution state ----
	//current job status
	this.status = opts.status || JOB_STATUS.READY;
	//last error
	this.error  = null;
	//in flight + last run. 
	this.run    = null;


	// ---- runtime flags ----
	// These describe job lifecycle, not configuration
	this.flags = lib.hash.merge({
            attached : true,   // bound to DOM + scheduler
            hasRun   : false,  // has executed at least once
            dirty    : false   // marked for reconfigure/rebuild
	    
	}, lib.hash.to(opts.flags));

	
    }
    /**
     * Assign or update the registry-owned identity for this Job.
     *
     * CONTRACT
     * --------
     * setIdentity() assigns the canonical identity metadata for the Job.
     * Identity is controlled by the registry layer and not by configuration.
     *
     * This method supports flows where:
     *   - A Job is constructed before being registered.
     *   - Identity is injected after instantiation.
     *
     *
     * SEMANTICS
     * ---------
     * - id is the globally unique Job identifier.
     * - createdAt is the authoritative creation timestamp (epoch ms).
     * - Either field may be omitted to preserve the existing value.
     *
     * The method is idempotent and defensive.
     * It may be called more than once in controlled scenarios
     * (testing, re-registration), though normal flow sets identity once.
     *
     *
     * INPUT
     * -----
     * @param {Object} [args]
     *
     * @param {string|number} [args.id]
     *   Unique identifier assigned by the registry.
     *
     * @param {number} [args.createdAt]
     *   Creation timestamp in epoch milliseconds.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate uniqueness.
     * Does not interact with configuration.
     * Does not trigger lifecycle transitions.
     */
    setIdentity({ id, createdAt } = {}) {
	if (id != null) this.id = id;
	if (createdAt != null) this.createdAt = createdAt;
	return this;
    }

    // ---- Begin Configuration Aliases ----

    /**
     * Logical name of this Job.
     *
     * CONTRACT
     * --------
     * name is a human-facing identifier intended for debugging,
     * logging, and optional lookup. It is not guaranteed to be unique.
     *
     * SOURCE OF TRUTH
     * ---------------
     * The value is delegated to this.config.name and is derived from
     * compiled configuration schema.
     *
     * If configuration has not been built, or no name was defined,
     * this getter may return null.
     *
     *
     * IDENTITY DISTINCTION
     * --------------------
     * - job.id is the authoritative unique identifier.
     * - job.name is a convenience label only.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string|null}
     *   Logical job name, or null if undefined.
     */
    get name() {
	return this.config.name;
    }

    /**
     * Assign or override the logical name for this Job.
     *
     * CONTRACT
     * --------
     * setName() updates the human-facing name associated with this Job.
     * The name is stored on this.config and may later be replaced by
     * compiled schema during configuration build.
     *
     *
     * SEMANTICS
     * ---------
     * - This does not affect job.id.
     * - This does not affect scheduler or registry identity.
     * - This is a convenience override and may be superseded by configuration.
     *
     *
     * TYPICAL USE CASES
     * -----------------
     * - Bootstrapping jobs before configuration build.
     * - Template-based instantiation.
     * - Developer-facing diagnostics or labeling.
     *
     *
     * INPUT
     * -----
     * @param {string|null} name
     *   Human-readable job name. May be null to clear.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate uniqueness.
     * Does not freeze configuration.
     * Does not trigger lifecycle changes.
     */
    setName(name) {
	this.config.name = name;
	return this;
    }

    /**
     * Build or rebuild this Job's configuration.
     *
     * CONTRACT
     * --------
     * configure() is a thin delegation wrapper over JobConfig.build().
     * It performs:
     *   - DOM input read
     *   - config reference resolution
     *   - schema compilation
     *
     * Artifact derivation is not performed in the current v1 posture.
     *
     *
     * SEMANTICS
     * ---------
     * - Safe to call multiple times.
     * - Mutates this.config internal state.
     * - May update this.status and this.error if configuration fails.
     * - Does not execute pipelines.
     *
     *
     * FAILURE POLICY
     * --------------
     * If JobConfig.build() does not return READY:
     *   - this.status is set to JOB_STATUS.ERROR
     *   - this.error is set to the returned status code
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts]
     *   Optional configuration overrides merged with
     *   this.opts.conf.config before build().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job>}
     *   Resolves to this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not schedule work.
     * Does not enqueue pipelines.
     * Does not alter registry state.
     */
    async configure(opts) {
	const lib = this.lib;
	const cOpts = lib.hash.merge(lib.hash.to(this.opts.conf.config) , lib.hash.to(opts) );
	const status = await this.config.build({...cOpts});
	if( status !== JOB_CONFIG_STATUS.READY){
	    this.status = JOB_STATUS.ERROR;
	    this.error  = status;
	}
	return this;
    }

    // ---- End Configuration Aliases ----
    

    /**
     * Begin a new execution run for this Job.
     *
     * CONTRACT
     * --------
     * beginRun() initializes ephemeral per-run state and transitions the Job
     * into RUNNING status.
     *
     * This method is intended to be called by the runtime layer immediately
     * before pipeline execution begins.
     *
     *
     * SEMANTICS
     * ---------
     * - Creates a new this.run record.
     * - Resets this.error to null.
     * - Sets this.status to JOB_STATUS.RUNNING.
     * - Does not validate configuration readiness.
     *
     * If job.id is not yet assigned, a temporary identifier is used in the
     * run id string for diagnostic purposes.
     *
     *
     * RUN RECORD SHAPE
     * ----------------
     * this.run = {
     *   id:        string,   // unique run identifier
     *   startedAt: number,   // epoch ms
     *   meta:      Object,   // runtime-provided metadata
     *   buffer:    any,      // optional scratch space
     *   request:   any,      // optional request reference
     *   response:  any       // optional response reference
     * }
     *
     *
     * INPUT
     * -----
     * @param {Object} [meta={}]
     *   Optional runtime metadata associated with this execution.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The newly created run record.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not perform execution.
     * Does not validate schema state.
     */
    beginRun(meta = {}) {
	// require an id once we're actually executing (optional but helps catch wiring mistakes)
	// if (this.id == null) throw new Error("[Job] beginRun called before Scheduler assigned job.id");

	this.run = {
	    id: `${this.id ?? "unregistered"}:run:${Date.now()}`,
	    startedAt: Date.now(),
	    meta,
	    buffer: undefined,
	    request: null,
	    response: null,
	};
	this.status = JOB_STATUS.RUNNING;
	this.error = null;
	return this.run;
    }

    /**
     * Finalize the current execution run for this Job.
     *
     * CONTRACT
     * --------
     * endRun() closes the active run record (if present) and transitions
     * the Job to a terminal or post-run status.
     *
     * This method is intended to be called by the runtime layer after
     * pipeline execution completes or fails.
     *
     *
     * SEMANTICS
     * ---------
     * - If this.run exists, sets run.endedAt to the current timestamp.
     * - Marks this.flags.hasRun = true.
     * - Sets this.status to the provided status value.
     * - Does not clear this.run (historical context is retained).
     *
     *
     * INPUT
     * -----
     * @param {string} [status=JOB_STATUS.COMPLETE]
     *   Lifecycle status to apply after run completion.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not execute pipelines.
     * Does not reset configuration.
     * Does not modify registry state.
     */
    endRun(status = JOB_STATUS.COMPLETE) {
	if (this.run) this.run.endedAt = Date.now();
	this.flags.hasRun = true;
	this.status = status;
	return this;
    }

    /**
     * Detach this Job from its runtime host.
     *
     * CONTRACT
     * --------
     * detach() transitions the Job into a non-attached state.
     * The Job remains valid but should no longer be scheduled or executed.
     *
     *
     * SEMANTICS
     * ---------
     * - Sets this.flags.attached = false.
     * - Sets this.status = JOB_STATUS.DETACHED.
     * - Does not modify configuration, identity, or workspace.
     *
     *
     * LIFECYCLE MODEL
     * ---------------
     * - Detachment is not an error condition.
     * - Detachment is not destruction.
     * - The Job instance remains inspectable and reusable.
     *
     *
     * TYPICAL USE CASES
     * -----------------
     * - DOM element removal.
     * - SPA navigation teardown.
     * - Registry rebuilds.
     * - Graceful shutdown flows.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not unregister the Job.
     * Does not clear schema or runtime state.
     * Does not destroy the instance.
     */
    detach() {
	this.flags.attached = false;
	this.status = JOB_STATUS.DETACHED;
	return this;
    }


    /**
     * Shutdown this Job.
     *
     * CONTRACT
     * --------
     * shutdown() is the lifecycle choke point indicating that the Job should
     * no longer run. In v1 it is effectively a thin wrapper around detach(),
     * but it exists as the stable entry point for future teardown behavior.
     *
     *
     * SEMANTICS
     * ---------
     * - Idempotent: if the Job is already detached, this is a no-op.
     * - Transitions the Job into a detached, non-runnable state.
     * - Optionally records a shutdown reason for diagnostics.
     *
     *
     * FUTURE EXTENSION POINT
     * ----------------------
     * This method is the intended place to add teardown actions such as:
     * - cancel in-flight runs
     * - stop intervals and event handlers
     * - abort requests
     * - release resources
     * - emit lifecycle events
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *
     * @param {string} [opts.reason]
     *   Optional human-readable reason for the shutdown.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not unregister the Job from a registry.
     * Does not clear configuration artifacts.
     * Does not guarantee cancellation of in-flight work in v1.
     */
    shutdown(opts = {}) {
	// Idempotent: shutting down an already-detached job is a no-op
	if (this.flags && this.flags.attached === false) return this;

	// Mark as detached / inactive
	if (typeof this.detach === "function") {
            this.detach();
	} else {
            // fallback safety (should not happen)
            this.flags.attached = false;
            this.status = JOB_STATUS.DETACHED;
	}

	// Optional bookkeeping
	if (opts.reason) {
            this.shutdownReason = opts.reason;
	}

	// Future:
	// - cancel intervals
	// - abort requests
	// - clear run state

	return this;
    }
    


}


# --- end: class/job/Job.js ---



# --- begin: class/job/Registry.js ---

/**
 * Job Registry
 * ============
 *
 * Central registry and identity manager for Job instances.
 *
 *
 * ROLE IN THE SYSTEM
 * ------------------
 * The Registry is the authoritative directory of all Jobs currently
 * known to the runtime. It owns identity assignment and provides
 * deterministic resolution across multiple lookup modes.
 *
 * It is a directory, not a runner.
 *
 *
 * RESPONSIBILITIES
 * ----------------
 * - Assign and guarantee unique job identity (id, createdAt).
 * - Maintain canonical indexes for resolving Jobs by:
 *     - id
 *     - DOM element
 *     - logical name (non-unique)
 * - Serve as the single source of truth for which Jobs exist.
 * - Coordinate controlled unregistration and lifecycle shutdown.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * - Does not execute Jobs.
 * - Does not enqueue or drain pipelines.
 * - Does not interpret schema or configuration.
 * - Does not mutate JobConfig.
 *
 *
 * IDENTITY MODEL
 * --------------
 * - id is the canonical unique identifier.
 * - name is an optional convenience alias and may collide.
 * - job.e (DOM element) is the physical anchor for registration.
 *
 *
 * INDEX STRUCTURE
 * ---------------
 * - byId   : Map<id, Job>
 * - byEl   : WeakMap<Element, id>
 * - byName : Map<name, Set<id>>
 *
 * WeakMap is used for DOM bindings to avoid memory leaks when
 * elements are garbage-collected.
 *
 *
 * RESOLUTION POLICY
 * -----------------
 * Resolution is ergonomic but deterministic:
 *   id → element → name → job-like object
 *
 * Name collisions are allowed but must be handled explicitly
 * by callers when multiple matches exist.
 *
 *
 * LIFECYCLE INTEGRATION
 * ---------------------
 * - unregister() invokes job.shutdown() before removal.
 * - Shutdown metadata may be recorded in a bounded diagnostic log.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * - Small and strict.
 * - No execution semantics.
 * - No hidden side effects.
 * - Identity and indexing must remain internally consistent.
 */


export default class Registry {
    /**
     * Create a new Job Registry instance.
     *
     * CONTRACT
     * --------
     * The Registry is a directory and identity authority for Jobs.
     * It assigns unique identifiers, maintains resolution indexes, and
     * coordinates controlled unregistration, but it does not execute jobs.
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *
     * @param {Object} opts.lib
     *   Required m7 lib instance.
     *
     * @param {Object} [opts.conf]
     *   Optional registry configuration object.
     *   When provided, prefix is read from conf.registry.prefix.
     *
     * @param {Object} [opts.env]
     *   Optional environment context (document, baseURI, hooks).
     *
     * @param {number} [opts.shutdownLogMax=200]
     *   Maximum number of shutdown records retained in shutdownLog.
     *   Older entries are discarded in FIFO order.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * Identity
     * - this.prefix    string prefix used when generating ids
     * - this.counter   monotonic counter used for id generation
     *
     * Indexes
     * - this.byId      Map<id, Job> primary identity index
     * - this.byEl      WeakMap<Element, id> element binding index
     * - this.byName    Map<name, Set<id>> optional secondary name index
     *
     * Metadata
     * - this.createdAt Map<id, number> creation timestamps (redundant with job.createdAt)
     * - this.shutdownLog Array diagnostic shutdown records (bounded FIFO)
     * - this.shutdownLogMax number max retained shutdown records
     *
     *
     * NOTES
     * -----
     * - All identity and index state is local to this Registry instance.
     * - Multiple registries may coexist without coordination.
     * - WeakMap is used for DOM bindings to avoid leaking detached DOM nodes.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if opts.lib is missing.
     */
    constructor(opts = {}) {
	if(!opts?.lib) throw new Error("registry requires lib");
	this.lib = opts.lib;
	this.conf = this.lib.hash.to(opts.conf);

	
	this.env =  opts.env;
	this.prefix = this.conf.registry.prefix || "DEFAULT__at";
	this.counter = 0;

	// Primary indexes
	this.byId = new Map();      // id -> job
	this.byEl = new WeakMap();  // element -> id

	// Optional secondary indexes
	this.byName = new Map();    // name -> Set(ids)

	// Metadata
	this.createdAt = new Map(); // id -> timestamp (redundant if job carries it)

	this.shutdownLog = [];          // array of entries (bounded)
	this.shutdownLogMax = opts.shutdownLogMax || 200;
    }

    /**
     * Resolve a job reference into a Job instance.
     *
     * CONTRACT
     * --------
     * resolve() converts a flexible job reference into a canonical Job
     * instance using registry resolution rules.
     *
     * This is a thin public wrapper around the internal _resolve() method.
     *
     *
     * ACCEPTED INPUT FORMS
     * --------------------
     * - id (string or number)
     * - DOM element bound to a Job
     * - Job instance
     * - job-like object (containing id and/or e)
     *
     *
     * RESOLUTION POLICY
     * -----------------
     * Resolution is tolerant but deterministic.
     * If no matching Job exists in the registry, null is returned.
     *
     *
     * INPUT
     * -----
     * @param {*} x
     *   Job reference of any supported type.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The resolved Job instance, or null if not found.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register jobs.
     * Does not mutate registry state.
     * Does not throw on resolution failure.
     */
    resolve(x) {
	return this._resolve(x);
    }
    /**
     * Generate the next unique Job id.
     *
     * CONTRACT
     * --------
     * nextId() produces a new identifier that is guaranteed to be unique
     * within this Registry instance.
     *
     * Ids are generated sequentially using the configured prefix and
     * an internal monotonic counter.
     *
     *
     * FORMAT
     * ------
     * `${prefix}-${counter}`
     *
     * The exact format is an implementation detail and should not be
     * parsed externally.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string}
     *   Newly generated unique Job identifier.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register the id.
     * Does not validate collisions externally.
     * Uniqueness is guaranteed only within this Registry instance.
     */
    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }
    /**
     * Determine whether a DOM element is already registered.
     *
     * CONTRACT
     * --------
     * hasElement() checks whether the provided DOM element is currently
     * bound to a Job within this Registry instance.
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element to test.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if the element is already associated with a registered Job.
     *   false otherwise.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve the Job.
     * Does not validate element type.
     * Does not mutate registry state.
     */
    hasElement(el) {
	return this.byEl.has(el);
    }
    /**
     * Retrieve the Job id associated with a DOM element.
     *
     * CONTRACT
     * --------
     * getIdByElement() returns the registered Job id bound to the
     * provided DOM element, if one exists.
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element previously registered with a Job.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string|null}
     *   The associated Job id if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve or return the Job instance.
     * Does not validate the element type.
     * Does not mutate registry state.
     */
    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }

    /**
     * Retrieve a Job by its id.
     *
     * CONTRACT
     * --------
     * getById() returns the registered Job associated with the provided
     * identifier, if one exists in this Registry instance.
     *
     *
     * INPUT
     * -----
     * @param {string} id
     *   Canonical Job identifier.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The corresponding Job instance if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not attempt resolution from other reference types.
     * Does not throw if the id is unknown.
     * Does not mutate registry state.
     */
    getById(id) {
	return this.byId.get(id) || null;
    }

    /**
     * Retrieve the Job bound to a specific DOM element.
     *
     * CONTRACT
     * --------
     * getByElement() resolves the Job associated with the provided
     * DOM element, if one exists in this Registry instance.
     *
     * Resolution is performed by:
     *   1) Looking up the Job id via getIdByElement()
     *   2) Retrieving the Job via getById()
     *
     *
     * INPUT
     * -----
     * @param {Element} el
     *   DOM element previously registered with a Job.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The associated Job instance if found; otherwise null.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register elements.
     * Does not validate element type.
     * Does not mutate registry state.
     */
    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    /**
     * Retrieve a Job by its logical name.
     *
     * CONTRACT
     * --------
     * getByName() attempts to resolve a Job using its convenience name.
     * Because names are not required to be unique, resolution is strict:
     *
     *   - If exactly one Job matches, it is returned.
     *   - If multiple Jobs share the name, a warning may be emitted and
     *     null is returned to avoid ambiguity.
     *   - If no Jobs match, null is returned.
     *
     *
     * SEMANTICS
     * ---------
     * - This is a convenience lookup only.
     * - Name uniqueness is not enforced by the Registry.
     * - Callers expecting multiple results should use listByName(name).
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   The uniquely resolved Job instance, or null if none or ambiguous.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce name uniqueness.
     * Does not mutate registry state.
     * Does not throw on ambiguity.
     */
    getByName(name) {
	const list = this.listByName(name);

	if (list.length === 1) return list[0];
	if (list.length > 1) {
            this._warn?.(
		"W101_AMBIGUOUS_NAME",
		name,
		`multiple jobs found for name "${name}"`
            );
	}
	return null;
    }

    /**
     * List all registered Jobs.
     *
     * CONTRACT
     * --------
     * list() returns a snapshot array of all Job instances currently
     * registered within this Registry.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of registered Job instances.
     *
     *
     * NOTES
     * -----
     * - The returned array is a shallow snapshot.
     * - Mutating the array does not affect registry state.
     * - Order is implementation-defined (insertion order of Map).
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not filter by status.
     * Does not sort.
     * Does not mutate registry state.
     */
    list() {
	return Array.from(this.byId.values());
    }

    /**
     * List all Jobs matching a given lifecycle status.
     *
     * CONTRACT
     * --------
     * listByStatus() returns a snapshot array of Jobs whose
     * job.status strictly equals the provided value.
     *
     *
     * SEMANTICS
     * ---------
     * - Comparison uses strict equality (===).
     * - No validation is performed on the status argument.
     * - If no Jobs match, an empty array is returned.
     *
     *
     * INPUT
     * -----
     * @param {string} status
     *   Lifecycle status to match (e.g. JOB_STATUS.READY, RUNNING, ERROR).
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of Jobs with a matching status.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not sort results.
     * Does not mutate registry state.
     * Does not validate status enum correctness.
     */
    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    /**
     * List all Jobs registered under a given logical name.
     *
     * CONTRACT
     * --------
     * listByName() returns all Job instances currently indexed under
     * the provided convenience name.
     *
     *
     * SEMANTICS
     * ---------
     * - Job names are not required to be unique.
     * - Always returns an array.
     * - If no Jobs match, an empty array is returned.
     * - Resolution is based on the current byName index.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job[]}
     *   Array of matching Job instances.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not validate name format.
     * Does not mutate registry state.
     */
    listByName(name) {
	if (!name) return [];

	const ids = this.byName.get(name);
	if (!ids || !ids.size) return [];

	const out = [];
	for (const id of ids) {
            const job = this.byId.get(id);
            if (job) out.push(job);
	}
	return out;
    }


    /**
     * Register a Job with this Registry.
     *
     * CONTRACT
     * --------
     * register() binds a Job into the Registry and establishes canonical
     * identity and resolution indexes.
     *
     * Registration is idempotent by DOM element:
     *   - If a Job is already registered for job.e, the existing Job is returned.
     *
     *
     * RESPONSIBILITIES
     * ----------------
     * - Ensure a single Job instance is associated with a given DOM element.
     * - Assign stable identity (id, createdAt) when missing.
     * - Maintain indexes:
     *     - byId:   id -> Job
     *     - byEl:   element -> id
     *     - byName: name -> Set<id> (optional, non-unique)
     * - Record createdAt metadata in the Registry (redundant with job.createdAt).
     *
     *
     * IDENTITY OWNERSHIP
     * ------------------
     * The Registry is the authority for identity uniqueness.
     * A pre-seeded job.id is respected only if it is not already in use.
     *
     *
     * COLLISION POLICY
     * ----------------
     * v1 policy is hard fail:
     *   - If the resolved id is already registered to a different Job,
     *     an Error is thrown to prevent silent overwrites.
     *
     *
     * NAME INDEXING
     * -------------
     * - job.name is optional and not guaranteed unique.
     * - Names are indexed into byName as: name -> Set<id>.
     * - Ambiguity is tolerated; strict resolution is handled at lookup time.
     *
     *
     * SIDE EFFECTS
     * ------------
     * - Mutates the Job via job.setIdentity({ id, createdAt }).
     * - Mutates internal registry indexes and metadata maps.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Job instance to register. Must have a bound DOM element at job.e.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   The registered Job instance (existing or newly registered).
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if:
     * - job is missing or job.e is missing
     * - an id collision is detected with an existing registered Job
     */
    register(job) {
	if (!job || !job.e) throw new Error("[Scheduler] register(job) requires job.e");

	// Already registered element => return existing job
	const existing = this.getByElement(job.e);
	if (existing) return existing;

	// Respect pre-seeded identity if present; otherwise assign
	let id = job.id || this.nextId();

	// ---- guard against overwrites (id collisions) ----
	// If the id is already in use by a different job, do NOT overwrite.
	// Policy: allocate a fresh id if caller provided a colliding id.
	// (If you prefer hard-fail instead, replace the while-loop with a throw.)
	const taken = this.byId.get(id);
	/*
	//soft - leave in the event I change my midn
	if (taken && taken !== job) {
        // If caller seeded an id and it's taken, roll forward until free
        do { id = this.nextId(); }
        while (this.byId.has(id));
	}
	*/
	//hard
	if (taken && taken !== job) {
	    throw new Error(`[Scheduler] register(): id collision "${id}"`);
	}

	
	const createdAt = (job.createdAt != null) ? job.createdAt : Date.now();

	job.setIdentity({ id, createdAt });

	this.byId.set(job.id, job);
	this.byEl.set(job.e, job.id);

	// Metadata index (redundant if job carries it, but you use it in unregister)
	this.createdAt.set(job.id, createdAt);

	// Optional name index (probably wont be set yet. use setName later)
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }

    /**
     * Unregister a Job from this Registry.
     *
     * CONTRACT
     * --------
     * unregister() removes a Job from all registry indexes and records a
     * bounded shutdown entry. It attempts a graceful teardown by invoking
     * job.shutdown() before removal.
     *
     * If the target cannot be resolved, this method is a no-op and returns false.
     *
     *
     * RESOLUTION
     * ----------
     * The target may be provided as:
     * - Job instance
     * - job id (string/number)
     * - DOM element bound to a Job
     * - job-like object (id/e)
     *
     * Resolution is performed via the internal _resolve() policy.
     *
     *
     * SHUTDOWN ORDER
     * --------------
     * job.shutdown() is invoked before index removal so the Job may perform
     * teardown while it still has access to its environment context.
     *
     *
     * METADATA
     * --------
     * - A shutdown record is written via _recordShutdown().
     * - The shutdown log is bounded (FIFO) to prevent memory growth.
     *
     *
     * SIDE EFFECTS
     * ------------
     * - Invokes job.shutdown({ reason }).
     * - Removes the Job from:
     *     - byId
     *     - byEl
     *     - byName (if indexed)
     *     - createdAt
     * - Appends a bounded diagnostic record to shutdownLog.
     *
     *
     * IDEMPOTENCY
     * -----------
     * - Safe to call repeatedly.
     * - Returns false if the Job is not currently registered.
     *
     *
     * INPUT
     * -----
     * @param {Job|string|number|Element|Object} jobOrIdOrEl
     *   Job reference, job id, DOM element, or job-like object.
     *
     * @param {Object} [opts={}]
     *
     * @param {string} [opts.reason]
     *   Optional human-readable reason used for shutdown and diagnostics.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  if a Job was resolved and unregistered.
     *   false if no matching Job was found.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not cancel Engine queues directly.
     * Does not destroy the Job instance.
     * Does not prevent the caller from re-registering later.
     */
    unregister(jobOrIdOrEl, opts = {}) {
	const job = this._resolve(jobOrIdOrEl);
	if (!job) return false;

	// shutdown first (so job can still access scheduler-related context if needed)
	job.shutdown({ reason: opts.reason || "scheduler.unregister" });

	// record shutdown metadata (bounded)
	this._recordShutdown(job, { reason: opts.reason || "scheduler.unregister" });

	// remove from indexes
	this.byId.delete(job.id);
	this.createdAt.delete(job.id);
	this.byEl.delete(job.e);
	if (job.name) this._unindexName(job.name, job.id);

	return true;
    }

    /**
     * Assign or update the logical name of a Job and maintain name indexes.
     *
     * CONTRACT
     * --------
     * setName() is the registry-managed pathway for updating a Job's
     * convenience name while keeping the byName index consistent.
     *
     *
     * SEMANTICS
     * ---------
     * - Names are convenience identifiers and are not unique.
     * - Multiple Jobs may share the same name.
     * - Internally, byName maps: name -> Set<id>.
     *
     *
     * BEHAVIOR
     * --------
     * - If the Job currently has a name, the Job id is removed from the old
     *   byName bucket.
     * - The new name is assigned via job.setName(name).
     * - The Job id is indexed under the new name (if name is truthy).
     *
     *
     * SAFETY
     * ------
     * - If job is missing or job.id is missing, this is a no-op.
     *   Jobs must be registered before they can be indexed by name.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Registered Job instance to update.
     *
     * @param {string|null} name
     *   New logical name to assign. Falsy clears the name and removes indexing.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not register the Job.
     * Does not mutate other indexes beyond name indexing.
     */
    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.setName(name);
	this._indexName(name, job.id);
    }


    // ---- INTERNAL METHODS ----

    /**
     * Add a Job id to the secondary name index.
     *
     * CONTRACT
     * --------
     * _indexName() associates a Job id with a logical name inside
     * the byName index.
     *
     *
     * SEMANTICS
     * ---------
     * - Multiple ids may be associated with the same name.
     * - Names map to Set<id> for efficient add and delete operations.
     * - Operation is idempotent for an existing (name, id) pair.
     *
     *
     * SAFETY
     * ------
     * - Falsy names are ignored.
     * - Does not validate id existence in byId.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     * @param {string|number} id
     *   Job id to associate with the name.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enforce uniqueness.
     * Does not register the Job.
     * Does not emit warnings on collisions.
     */
    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    /**
     * Remove a Job id from the secondary name index.
     *
     * CONTRACT
     * --------
     * _unindexName() removes the association between a logical name
     * and a Job id within the byName index.
     *
     *
     * SEMANTICS
     * ---------
     * - If the id exists in the name's Set, it is removed.
     * - If the resulting Set becomes empty, the name entry is deleted
     *   entirely from byName.
     *
     *
     * SAFETY
     * ------
     * - No-op if the name is not indexed.
     * - No-op if the id is not present in the Set.
     *
     *
     * INPUT
     * -----
     * @param {string} name
     *   Logical Job name.
     *
     * @param {string|number} id
     *   Job id to remove from the name mapping.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate id existence in byId.
     * Does not throw on missing mappings.
     */
    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }


    /**
     * Internal resolution primitive for converting a reference into a Job.
     *
     * CONTRACT
     * --------
     * _resolve() attempts to normalize a flexible job reference into a
     * canonical Job instance using registry indexes.
     *
     * This method never throws and returns null on failure.
     *
     *
     * RESOLUTION ORDER
     * ----------------
     * 1) Falsy input
     *    - null or undefined → null
     *
     * 2) String
     *    - Attempt id lookup via getById()
     *    - Fallback to name lookup via getByName()
     *
     * 3) DOM Element
     *    - Resolve via element binding (getByElement)
     *
     * 4) Job-like object (id and e present)
     *    - Assumed to already represent a Job; returned as-is
     *
     * 5) Object with e property
     *    - Resolve via element binding
     *
     * 6) Otherwise
     *    - null
     *
     *
     * FAILURE POLICY
     * --------------
     * - Returns null if resolution fails.
     * - Does not emit warnings except those triggered by getByName().
     *
     *
     * INPUT
     * -----
     * @param {*} x
     *   Flexible Job reference:
     *     - id (string)
     *     - name (string)
     *     - DOM element
     *     - Job instance
     *     - object containing { e: Element }
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job|null}
     *   Resolved Job instance, or null if no match.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not register Jobs.
     * Does not validate schema state.
     * Does not mutate registry state.
     */
    _resolve(x) {
	if (!x) return null;

	// string: id first, then name
	if (typeof x === "string") {
            const byId = this.getById(x);
            if (byId) return byId;

            // fallback to name
            return this.getByName(x);
	}

	// element
	if (x.nodeType === 1) return this.getByElement(x);

	// job-like (already a job)
	if (x.id && x.e) return x;

	// object containing element
	if (x.e) return this.getByElement(x.e);

	return null;
    }


    /**
     * Record a shutdown event for a Job.
     *
     * CONTRACT
     * --------
     * _recordShutdown() appends a lightweight, bounded diagnostic entry
     * describing a Job shutdown event.
     *
     * This log is intended for debugging and lifecycle inspection only.
     * It is not a durable audit trail.
     *
     *
     * SEMANTICS
     * ---------
     * - Captures a shallow snapshot of identity and DOM context.
     * - Appends the entry to this.shutdownLog.
     * - Enforces a FIFO bound using this.shutdownLogMax.
     *
     *
     * CAPTURED FIELDS
     * ---------------
     * - at     : number   timestamp (epoch ms)
     * - id     : string|null   Job id
     * - name   : string|null   logical Job name
     * - reason : string|null   optional shutdown reason
     * - tag    : string|null   lowercased DOM tag name
     * - elId   : string|null   DOM element id attribute
     *
     *
     * BOUNDING POLICY
     * ---------------
     * - If shutdownLogMax > 0, the log is truncated to the most recent
     *   shutdownLogMax entries.
     * - Oldest entries are removed first (FIFO).
     *
     *
     * FAILURE POLICY
     * --------------
     * - Never throws.
     * - Logging is best-effort and intentionally shallow.
     *
     *
     * INPUT
     * -----
     * @param {Job} job
     *   Job instance being shut down.
     *
     * @param {Object} [info={}]
     *
     * @param {string} [info.reason]
     *   Optional human-readable shutdown reason.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {void}
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not persist logs externally.
     * Does not emit events.
     * Does not mutate Job state.
     */
    _recordShutdown(job, info = {}) {
	const entry = {
            at: Date.now(),
            id: job.id || null,
            name: job.name || null,
            reason: info.reason || null,
            tag: job.e && job.e.tagName ? String(job.e.tagName).toLowerCase() : null,
            elId: job.e && job.e.id ? String(job.e.id) : null,
	};

	this.shutdownLog.push(entry);

	// Bound the log (FIFO)
	const max = this.shutdownLogMax;
	if (max > 0 && this.shutdownLog.length > max) {
            this.shutdownLog.splice(0, this.shutdownLog.length - max);
	}
    }
}


# --- end: class/job/Registry.js ---



# --- begin: class/observer/Controller.js ---

/**
 * Observer/Controller
 * ------------------
 *
 * ActiveTags-facing policy and lifecycle wrapper for the shared DOM observer service.
 *
 * This controller owns the **ActiveTags policy layer** around the
 * shared DOM change observer service (`AT.svc.domObserver`).
 *
 * It does NOT implement `MutationObserver` itself.
 * Instead, it:
 * - Configures selector policy from compiled configuration
 * - Subscribes to DOM change batches via the observer service
 * - Translates DOM mutations into **job registration / unregistration signals**
 *
 * ARCHITECTURAL ROLE:
 * - Acts as the bridge between DOM mutation signals and the Job Registry
 * - Owns *policy*, not *mechanism*
 * - Consumes a shared observer service; does not create or destroy it
 *
 * CURRENT SEMANTICS:
 * - Observer callbacks are treated as **fire-and-forget signals**
 * - Job registration is invoked synchronously from the callback
 * - No ordering, batching, or backpressure is enforced at this layer
 *
 * DESIGN CONSTRAINTS:
 * - Observer callbacks are synchronous by browser contract
 * - Returning or awaiting Promises from callbacks has no effect upstream
 *
 * FUTURE CONSIDERATIONS:
 * - If job registration becomes expensive or requires sequencing,
 *   introduce an internal async queue or drain loop here.
 * - Backpressure, coalescing, or debouncing of mutation batches
 *   should be implemented **inside this controller**, not by
 *   altering observer callback semantics.
 * - Any async control should preserve the observer as a pure signal source.
 *
 * NON-RESPONSIBILITIES:
 * - Does NOT execute jobs or pipelines
 * - Does NOT manage engine lifecycle
 * - Does NOT mutate the DOM
 * - Does NOT guarantee ordering of mutation processing
 *
 * @todo Revisit instance freezing strategy if mutable state grows.
 * @todo Clarify start/stop ownership semantics when observer service is shared.
 */
export default class Controller {
    /**
     * Create an Observer/Controller bound to an ActiveTags instance.
     *
     * This controller manages the **local** lifecycle/policy around the shared
     * DOM observer service (`AT.svc.domObserver`). It does not implement the
     * observer; it configures and consumes it.
     *
     * CONTRACT:
     * - Requires `AT` and `lib`.
     * - Accepts `toJob` for parity with other controllers (may be used later).
     * - Hard-asserts required runtime wiring up-front:
     *     - `AT.svc.domObserver` must exist
     *     - `AT.conf.env.document` must exist and support `querySelectorAll`
     *
     * @param {Object} deps
     * @param {Object} deps.lib
     *   m7 lib instance.
     *
     * @param {Object} deps.AT
     *   ActiveTags instance (source of conf, env, registry, services).
     *
     * @param {Function} deps.toJob
     *   Job resolver helper: (ref:any) => Job|undefined
     *   Note: stored for controller parity / future use.
     *
     * @throws {Error}
     *   If required dependencies or required ActiveTags wiring is missing.
     *
     * @notes
     * - `Object.freeze(this)` is intentionally left as a future consideration.
     *   If enabled, controller state must be moved into a mutable sub-object
     *   (e.g. `this.state = { ... }`) before freezing.
     */
    constructor({ lib, AT, toJob } = {}) {
	if (!lib) throw new Error("Observer/Controller: lib required");
	if (!AT)  throw new Error("Observer/Controller: AT required");
	if (typeof toJob !== "function") throw new Error("Observer/Controller: toJob required");

	// Required services (fail-fast like Interval/Event controllers)
	const obs = AT.svc && AT.svc.domObserver;
	if (!obs) throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");

	// Required env (fail-fast; no global fallbacks)
	const env = AT.conf && AT.conf.env;
	const doc = env && env.document;
	if (!doc || typeof doc.querySelectorAll !== "function") {
            throw new Error("Observer/Controller: AT.conf.env.document is invalid or missing");
	}

	// Controller wiring (pattern parity)
	this.lib      = lib;
	this.AT       = AT;
	this.toJob    = toJob;

	this.engine   = AT.engine;
	this.conf     = AT.conf;
	this.jobs     = AT.jobs;
	this.env      = env;

	this.observer = obs;

	// last applied selector specs (optional introspection)
	this._selectorSpecs = null;
	
	//Object.freeze(this);
    }
    
    /**
     * Start DOM observation using config-derived selector specs.
     *
     * This method configures the shared observer service (`this.observer`) with the
     * compiled selector policy, then starts observation.
     *
     * CONTRACT:
     * - Reads selector policy from:
     *     - `this.conf.observe.selectors|selector` (if present)
     *     - otherwise `this.conf.boot.selector` (fallback)
     * - Installs one selectorSpec per selector with:
     *     - subtree matching enabled
     *     - attribute observation enabled
     * - Binds the observer callback to this controller (`onEvent → _onDomChanges`)
     *
     * Idempotency:
     * - This method is idempotent only to the extent that the underlying observer
     *   service is idempotent. Repeated calls may re-install selector specs and/or
     *   restart observation depending on service behavior.
     *
     * Failure modes:
     * - Throws if the observer service is missing.
     * - Throws if the resolved selector list is empty.
     * - Throws if the resolved attribute filter list is empty.
     *
     * Side effects:
     * - Mutates controller state: caches the installed selector specs on
     *   `this._selectorSpecs` (debug/introspection only).
     * - Calls into the shared observer service:
     *     - `obs.setSelectors(selectorSpecs)`
     *     - `obs.start()`
     *
     * Async note:
     * - Observer callbacks are synchronous by browser contract; even if `_onDomChanges`
     *   triggers async work (e.g., `AT.discover.registerJobs()`), the observer will not await it.
     * - If sequencing, backpressure, or batch coalescing becomes necessary, implement
     *   it inside this controller (queue/drain), not by making the observer callback `async`.
     *
     * @throws {Error}
     *   If required observer wiring or required selector configuration is missing/invalid.
     */

    start() {
	const { lib } = this;

	// required service (fail-fast)
	const obs = this.observer;
	if (!obs) {
            throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");
	}

	// required env (no globals)
	const env = this.conf.env;
	const document = env && env.document;
	if (!document || typeof document.querySelectorAll !== "function") {
            throw new Error("ObserveController.start(): conf.env.document is invalid or missing");
	}

	const observe = lib.hash.to(this.conf.observe);

	// --- selectors -------------------------------------------------------------

	let selectors = observe.selector || this.conf.boot.selector;

	// grease: coerce to array early
	selectors = lib.array.to(selectors);

	// normalize string(s) → clean selector list
	selectors = lib.array.filterStrings(selectors, { splitter: /\s+/ });

	if (!lib.array.len(selectors)) {
	    throw new Error("[ActiveTags] empty selector list on observer");
	}
	// --- attribute observation ------------------------------------------------
	const observeAttributes = !lib.bool.no(observe.observeAttributes);

	let attributeFilter = observe.attribute_filter;
	attributeFilter = lib.array.to(attributeFilter);
	attributeFilter = lib.array.filterStrings(attributeFilter, { splitter: /\s+/ });

	// if we're observing attributes, attributeFilter must be non-empty
	if (observeAttributes && !lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}

	// --- build selector specs -------------------------------------------------
	const selectorSpecs = selectors.map((selector) => ({
            selector,
            includeSubtreeMatches: true,
            observeAttributes,
            attributeFilter,
            onEvent: (batch) => this._onDomChanges(batch),
	}));

	this._selectorSpecs = selectorSpecs;

	obs.setSelectors(selectorSpecs);
	obs.start();
    }
    
    
    /**
     * Stop DOM observation.
     *
     * This method disengages the controller from the shared DOM observer service
     * by stopping observation.
     *
     * CONTRACT:
     * - Calls `stop()` on the shared observer service (`this.observer`).
     * - Does NOT destroy, null, or otherwise modify the observer service instance.
     *
     * DESIGN NOTES:
     * - Ownership of the observer service belongs to the ActiveTags service bag,
     *   not to this controller.
     * - This allows observation to be restarted later without re-creating the service.
     *
     * Idempotency:
     * - Safe to call multiple times.
     * - Calling `stop()` when the observer is already stopped is a no-op
     *   (subject to observer service behavior).
     *
     * Side effects:
     * - Halts delivery of DOM mutation batches to this controller.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT unregister jobs.
     * - Does NOT mutate controller configuration.
     * - Does NOT alter observer selector configuration.
     */
    stop() {
	const obs = this.observer; // <- from constructor
	if (!obs) return;
	obs.stop();
    }
    
    /**
     * Replace observer selector configuration at runtime.
     *
     * This is an advanced, low-level escape hatch that forwards selector
     * specifications directly to the underlying observer service.
     *
     * CONTRACT:
     * - Accepts a pre-built selector specification object/array.
     * - Forwards the specification verbatim to `observer.setSelectors(...)`.
     * - Caches the provided value on the controller for introspection/debugging.
     *
     * SEMANTICS:
     * - This method does NOT validate selector specs.
     * - The accepted shape is entirely defined by the observer service.
     * - Any existing selector configuration is replaced.
     *
     * USE CASES:
     * - Dynamic reconfiguration of observation policy.
     * - Debugging or instrumentation tooling.
     * - Advanced integrations that bypass config-driven selectors.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT start or stop observation.
     * - Does NOT merge selector specs.
     * - Does NOT normalize or derive selectors from config.
     *
     * FAILURE MODES:
     * - If the observer service is missing, this method is a no-op.
     * - Invalid selector specs may cause errors downstream in the observer service.
     *
     * @param {*} selectorSpecs
     *   Selector specification(s) understood by the underlying observer service.
     */
    setSelectors(selectorSpecs) {
	const obs = this.observer;
        if (!obs) return;
        this._selectorSpecs = selectorSpecs;
        obs.setSelectors(selectorSpecs);
    }

    /**
     * Collect DOM elements matching a selector from a DomChangeObserver record list.
     *
     * This helper extracts **eligible root nodes and their matching descendants**
     * from a batch of observer records. It is intentionally defensive and tolerant
     * of partial or malformed records.
     *
     * CONTRACT:
     * - Accepts a list of observer records (typically from DomChangeObserver).
     * - Each record is expected to contain an `el` property referencing a DOM node.
     * - Returns a de-duplicated list of element nodes (`nodeType === 1`) that:
     *     - match the selector themselves, and/or
     *     - are descendants of a record root that match the selector.
     *
     * SEMANTICS:
     * - De-duplication is enforced across roots and descendants.
     * - Only element nodes are returned.
     * - Non-element nodes and invalid records are ignored.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT validate record structure beyond checking `rec.el`.
     * - Does NOT mutate records or DOM nodes.
     * - Does NOT create, register, or execute jobs.
     *
     * @param {Array} records
     *   List of observer records.
     *   Records are expected to be shaped like:
     *     `{ el: HTMLElement, selectors?: string[] }`
     *   Additional fields are ignored.
     *
     * @param {string} selector
     *   Comma-separated selector list used for `matches()` and `querySelectorAll()`.
     *
     * @returns {HTMLElement[]}
     *   De-duplicated array of matching element nodes.
     */
    _collectMatchingNodes(records, selector) {
        const out = [];
        const seen = new Set();

        const push = (n) => {
            if (!n || n.nodeType !== 1) return;
            if (seen.has(n)) return;
            seen.add(n);
            out.push(n);
        };

        records = this.lib.array.to(records);

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            const root = rec && rec.el ? rec.el : null;
            if (!root || root.nodeType !== 1) continue;

            if (root.matches && root.matches(selector)) push(root);

            if (root.querySelectorAll) {
                const found = root.querySelectorAll(selector);
                for (let j = 0; j < (found ? found.length : 0); j++) push(found[j]);
            }
        }

        return out;
    }


    /**
     * Handle a DomChangeObserver event batch.
     *
     * This method translates low-level DOM mutation signals into **job registry
     * actions** based on the current observation policy.
     *
     * BEHAVIOR:
     * - Added or changed nodes:
     *     - Extract matching elements (roots + descendants)
     *     - Ensure corresponding jobs are registered
     * - Removed or change-away nodes:
     *     - Unregister jobs bound to the affected elements
     *
     * SELECTOR POLICY:
     * - Selectors are resolved at call time from:
     *     - `this.conf.observe.selectors|selector` (if present)
     *     - otherwise `this.conf.boot.selector`
     * - Multiple selectors are joined into a single comma-separated selector
     *   for matching.
     *
     * EXECUTION MODEL:
     * - This method is invoked synchronously by the observer service.
     * - Calls to `AT.discover.registerJobs()` are fire-and-forget.
     * - No ordering, backpressure, or batching guarantees are enforced here.
     *
     * FAILURE TOLERANCE:
     * - Invalid or missing batch fields are tolerated.
     * - Missing or empty selector configuration causes early return.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute jobs or pipelines.
     * - Does NOT await asynchronous job registration.
     * - Does NOT mutate observer configuration.
     * - Does NOT guarantee consistency across rapid mutation bursts.
     *
     * @param {Object} batch
     *   DomChangeObserver event payload.
     *   Expected to contain arrays keyed by:
     *     - `added`
     *     - `changed`
     *     - `removed`
     *     - `changeAway`
     *   Missing keys are treated as empty arrays.
     *
     * @returns {Object|undefined}
     *   Optional summary object containing mutation counts:
     *     `{ addedCount, changedCount, removedCount, changeAwayCount }`
     *   Returned for diagnostics only; ignored by the observer service.
     */
    _onDomChanges(batch) {
        const lib = this.lib;

        const parts = lib.hash.expand(batch || {}, "added changed removed changeAway");
        const added = parts[0] || [];
        const changed = parts[1] || [];
        const removed = parts[2] || [];
        const changeAway = parts[3] || [];

        // derive selectors from config (single source of truth)
        const rawSelectors = lib.hash.getUntilNotEmpty(this.conf.observe || {}, "selectors selector", this.conf.boot.selector);
        const selectors = lib.array.filterStrings(rawSelectors, { splitter: /\s+/ });
        if (!lib.array.len(selectors)) return;

        const selector = selectors.join(",");

        // add + changed => ensure jobs exist
        if (lib.array.len(added)) {
            const out = this._collectMatchingNodes(added, selector);
	    if ( lib.array.len(out) ) this.AT.discover.registerJobs(out);
        }

        if (lib.array.len(changed)) {
            const out = this._collectMatchingNodes(changed, selector);
	    if ( lib.array.len(out) ) this.AT.discover.registerJobs(out);
        }

        // removed + changeAway => unregister jobs
        if (lib.array.len(removed)) {
            for (let i = 0; i < removed.length; i++) {
                const el = removed[i] && removed[i].el ? removed[i].el : null;
                if (el) this.jobs.unregister(el);
            }
        }

        if (lib.array.len(changeAway)) {
            for (let i = 0; i < changeAway.length; i++) {
                const el = changeAway[i] && changeAway[i].el ? changeAway[i].el : null;
                if (el) this.jobs.unregister(el);
            }
        }

        return {
            addedCount: added.length,
            changedCount: changed.length,
            removedCount: removed.length,
            changeAwayCount: changeAway.length,
        };
    }
}


# --- end: class/observer/Controller.js ---



# --- begin: constants.js ---

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


# --- end: constants.js ---



# --- begin: helpers/applyMixins.js ---

//only handles instance methods for now.

export function applyMixins(targetClass, ...mixins) {
    for (const mixin of mixins) {
        Object.assign(targetClass.prototype, mixin);
    }
}

export default applyMixins;

/*
// instance methods , getters/setters ... work on statics too later.
export function applyMixins(targetClass, ...mixins) {
  for (const mixin of mixins) {
    Object.defineProperties(
      targetClass.prototype,
      Object.getOwnPropertyDescriptors(mixin)
    );
  }
}

export default applyMixins;
*/


# --- end: helpers/applyMixins.js ---



# --- begin: helpers/freezeDeep.js ---

/**
 * Deep-freeze an object graph.
 *
 * Purpose:
 * - Prevent mutation of creation-time / configuration artifacts.
 * - Intended for "build once, read many" structures.
 *
 * Semantics:
 * - Recursively freezes arrays and plain objects.
 * - Scalars and non-plain objects are frozen shallowly or ignored.
 *
 * Notes:
 * - This mutates the input object by freezing it.
 * - Callers should deep-copy first if mutation is undesirable.
 *
 * @param {*} value
 * @returns {*} The same value, deeply frozen if applicable.
 */
function freezeDeep(value) {
    if (!value || typeof value !== "object") return value;
    if (Object.isFrozen(value)) return value;

    // Array
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            freezeDeep(value[i]);
        }
        return Object.freeze(value);
    }

    // Plain object only
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        return Object.freeze(value);
    }

    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        freezeDeep(value[key]);
    }

    return Object.freeze(value);
}

export { freezeDeep };
export default freezeDeep;


# --- end: helpers/freezeDeep.js ---



# --- begin: helpers/reporter/configReporter.js ---

// helpers/reporter/configReporter.js

export function configReporter({ job, lib, log, bucketName } = {}) {
    if (!job) return;
    if (!lib) throw new Error("configReporter: missing lib");
    if (!log) return; // logging is optional by design
    if (!bucketName) throw new Error("configReporter: missing bucket name");
    const bucket = bucketName;

    const domReport    = lib.hash.get(job, "config.inputs.report");
    const schemaReport = lib.hash.get(job, "config.schemaReport");

    const emit = (phase, rep) => {
        if (!rep || typeof rep !== "object") return;

        const errors   = lib.array.to(rep.errors);
        const warnings = lib.array.to(rep.warnings);

        if (!errors.length && !warnings.length) return;

        const toRow = (entry, level) => {
            entry = lib.hash.to(entry);

            const code = lib.str.to(entry.code || entry.id || entry.key, true).trim();
            const path = lib.str.to(entry.path || entry.at || entry.field, true).trim();
            const msg  = lib.str.to(entry.msg || entry.message || entry.text || entry.note, true).trim();

            return {
                jobId: job.id,
                jobName: job.name,
                phase,
                level,
                code: code || undefined,
                path: path || undefined,
                msg:  msg  || undefined,
                raw: entry,
            };
        };

        for (let i = 0; i < warnings.length; i++) {
            log.warn(bucket, toRow(warnings[i], "warn"), { event: "job.config.warn" });
        }
        for (let i = 0; i < errors.length; i++) {
            log.error(bucket, toRow(errors[i], "error"), { event: "job.config.error" });
        }
    };

    emit("dom", domReport);
    emit("schema", schemaReport);
}

export default configReporter;
/*
  //saving in case I want a basic reporter.
  const basicemit = (phase, rep) => {
  if (!rep || typeof rep !== "object") return;

  const errors   = lib.array.to(rep.errors);
  const warnings = lib.array.to(rep.warnings);

  if (!errors.length && !warnings.length) return;

  const body = {
  job: {
  id: job.id,
  name: job.name,
  // optionally include selector/type/etc if you have it
  },
  phase,              // "dom" | "schema"
  ok: rep.ok === true,
  report: { ok: rep.ok, errors, warnings }
  };

  // Emit warnings first (optional), errors second
  if (warnings.length) log.warn(bucket, body, { event: "job.config.warn" });
  if (errors.length)   log.error(bucket, body, { event: "job.config.error" });
  };

*/


# --- end: helpers/reporter/configReporter.js ---



# --- begin: helpers/requireLibs.js ---


/**
 * requireLibs(root, targets, opts?)
 *
 * Standalone dependency validator for nested paths.
 * Does NOT rely on m7 lib utilities (array/hash), so it can run during bootstrap.
 *
 * @param {object} root - root object to validate against (e.g. window.lib)
 * @param {string|string[]} targets - space-delimited string or array of dot-paths
 * @param {object} [opts]
 * @param {string} [opts.mod='[requireLibs]'] - label for error messages
 * @param {boolean} [opts.returnMap=false] - return {path:value} instead of array
 * @param {boolean} [opts.allowFalsy=true] - if false, falsy values fail (rare)
 * @returns {any[]|Record<string, any>} resolved values
 * @throws Error if any target is missing
 */

export function requireLibs(root, targets, opts = {}) {
    opts = lib.hash.to(opts, "mod");
    const mod       = lib.hash.get(opts, "mod", "[requireLibs]");
    const returnMap = !!lib.hash.get(opts, "returnMap", false);
    const die       = lib.hash.get(opts, "die", true);

    // default policy: must exist, and resolved value must NOT be nullish
    const truthy = !!lib.hash.get(opts, "truthy", false);

    if (!lib.utils.baseType(root, "object")) {
	throw new Error(`${mod} invalid root (expected object)`);
    }

    const list = lib.array.to(targets, /\s+/);

    const outArr = [];
    const outMap = {};
    const missing = [];

    for (const path of list) {
	// structural existence check first (fast + pinpoints missing paths)
	if (!lib.hash.exists(root, path)) {
	    missing.push(path);
	    continue;
	}

	const val = lib.hash.get(root, path);

	// default: disallow null/undefined
	const ok = truthy ? !!val : (val !== null && val !== undefined);

	if (!ok) {
	    missing.push(path);
	    continue;
	}

	outArr.push(val);
	outMap[path] = val;
    }

    if (missing.length && die) {
	throw new Error(`${mod} missing required targets: ${missing.join(", ")}`);
    }

    return returnMap ? outMap : outArr;
}

export default requireLibs;


# --- end: helpers/requireLibs.js ---



# --- begin: traits/engine.js ---

export const trait_engine = {

    /**
     * Enqueue autorun pipelines for all currently registered jobs.
     *
     * CONTRACT
     * --------
     * `enqueueAll()` performs a one-time sweep over the JobRegistry and
     * requests enqueue of pipelines explicitly marked for autorun.
     *
     * It does not execute pipelines directly.
     * It does not mutate job configuration.
     * It does not manage scheduling or retries.
     *
     *
     * ELIGIBILITY RULES
     * -----------------
     * For each registered job:
     * - `job.config.schema.enabled` must not be `false`.
     * - `job.config.schema.autorun` must be a non-empty list.
     *
     * Jobs that do not satisfy both conditions are skipped.
     *
     *
     * AUTORUN SEMANTICS
     * -----------------
     * `job.config.schema.autorun` is treated as a list of pipeline keys.
     * Each key is enqueued independently.
     * The special token `"__DEFAULT__"` is normalized to `"default"`.
     *
     *
     * ENQUEUE PAYLOAD
     * ---------------
     * For each eligible key:
     * `engine.enqueue(job, pipelineKey, { inputs: { reason }, meta: { source: "enqueueAll" } })`
     *
     *
     * @param {string} [reason]
     * Optional reason label for telemetry/diagnostics.
     * Defaults to `"none given"` when empty.
     *
     * @returns {number}
     * Number of enqueue attempts issued.
     */

    enqueueAll(reason) {
	const lib = this.lib;
	const jobs = this.jobs.list();

	if (!lib.str.to(reason, true).trim())
            reason = 'none given';

	let count = 0;
	for (const job of jobs) {
            // enabled gate
            const enabled = lib.hash.get(job, "config.schema.enabled");
            if (enabled === false) continue;
	    
            // autorun list
            let autorun = lib.hash.get(job, "config.schema.autorun");
            if (!lib.array.len(autorun)) continue;

            for (let key of autorun) {
		if (!key) continue;

		// "__DEFAULT__" -> "default"
		if (key === "__DEFAULT__") key = "default";
		count++;
		const r = this.engine.enqueue(job, key, {
                    inputs: { reason },
                    meta: { source: "enqueueAll" },
		});
		console.log(r);
            }
	}
	return count;
    }
};

export default trait_engine;


# --- end: traits/engine.js ---



# --- begin: traits/job.js ---

/**
 * Job Resolution Trait
 * --------------------
 *
 * This trait provides a minimal, stable abstraction for resolving
 * references into registered `Job` instances.
 *
 * It acts as a thin convenience layer over the job registry and is
 * intentionally small. Additional job-related surface area may be added
 * here in the future.
 *
 * RESPONSIBILITIES:
 * - Resolve job references into concrete `Job` instances
 * - Delegate resolution logic to the runtime job registry
 *
 * NON-RESPONSIBILITIES:
 * - Does NOT create jobs
 * - Does NOT register jobs
 * - Does NOT execute, schedule, or mutate jobs
 * - Does NOT validate job state or configuration
 *
 * DESIGN NOTES:
 * - This trait exists to avoid leaking registry internals to callers
 * - Resolution semantics are owned by the job registry (`this.jobs`)
 * - Callers should treat returned jobs as opaque runtime objects
 *
 * Typical usage:
 * - Resolve a job by id
 * - Resolve a job by DOM element
 * - Resolve a job-like reference passed through APIs
 */
export const trait_job = {

    /**
     * Resolve a job reference into a registered `Job` instance.
     *
     * Resolution semantics are delegated to the job registry.
     * The registry may support resolution by:
     * - Job id (string)
     * - DOM element
     * - Job-like object
     *
     * @param {*} ref
     *   Job reference to resolve.
     *   The accepted types depend on the registry implementation.
     *
     * @returns {Job|undefined}
     *   The resolved `Job` instance if found, otherwise `undefined`.
     *
     * @notes
     * - This method is side-effect free.
     * - Returning `undefined` indicates the reference could not be resolved.
     */
    toJob(ref) {
        return this.jobs.resolve(ref) || undefined;
    }
};

export default trait_job;


# --- end: traits/job.js ---

