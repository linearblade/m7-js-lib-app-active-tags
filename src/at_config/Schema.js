// at_config/Schema.js
/**
 * ActiveTags Configuration Schema
 * --------------------------------
 *
 * This module defines the canonical configuration compiler for ActiveTags.
 *
 * PURPOSE:
 * - Normalize, merge, and validate configuration inputs into a single
 *   deterministic runtime configuration object.
 * - Establish clear precedence rules between defaults, user config,
 *   and system safety nets.
 *
 * THIS IS NOT:
 * - A JSON Schema
 * - A runtime controller
 * - A configuration loader
 * - A validation framework that enforces business semantics
 *
 * WHAT THIS MODULE DOES:
 * - Accepts factory defaults (`def_conf`)
 * - Accepts optional user configuration
 * - Compiles configuration transactionally into `active`
 * - Guarantees stable shapes and types for downstream systems
 *
 * CONFIGURATION SOURCES (high level):
 *   1) Factory defaults (def_conf)
 *   2) User configuration (constructor / merge input)
 *   3) Constants (final safety net only)
 *
 * DESIGN PRINCIPLES:
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
 * EXPECTATION FOR CONTRIBUTORS:
 * - New config fields must be normalized here
 * - Do NOT introduce runtime behavior into this module
 * - Constants may be used ONLY as final safety nets
 */
import CONSTANTS  from "../constants.js"; // adjust path as needed
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
     * Return a detached snapshot of the currently compiled active configuration.
     *
     * CONTRACT:
     * - Does NOT mutate schema state.
     * - Returns a deep copy of `this.active` so external callers cannot
     *   accidentally mutate internal schema state.
     *
     * SEMANTICS:
     * - This is the primary "read surface" for the compiled configuration.
     * - The returned object is detached from `this.active`.
     * - No recompilation occurs (use `merge()` for that).
     *
     * RESPONSIBILITIES:
     * - Provide a safe, stable external view of the compiled config.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT freeze the returned object.
     * - Does NOT validate runtime capability.
     *
     * @returns {Object}
     *   A detached deep copy of the current compiled configuration.
     *
     * @throws {Error}
     *   If no active config exists (unexpected after successful construction).
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
     * Derive and normalize the execution environment configuration.
     *
     * CONTRACT:
     * - Pure function with respect to schema state.
     * - Does NOT mutate `active` or `user` directly.
     * - Returns a fully-populated, canonical environment object.
     * - Never throws under normal conditions.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Implicit global environment (`globalThis`)
     *   2) Environment derived from `lib._env` (legacy + modern)
     *   3) User-provided environment (`user.env`)
     *
     * DERIVATION RULES:
     * - `root` is resolved first and represents the global execution context.
     * - `window` is resolved from:
     *     user.env.window → root.window → root
     * - `document` is resolved from:
     *     user.env.document → window.document
     * - `baseURI` is resolved from:
     *     user.env.baseURI → document.baseURI
     *
     * RESPONSIBILITIES:
     * - Normalize and validate the shape of the environment object.
     * - Resolve legacy and modern `lib._env` layouts.
     * - Provide consistent references for DOM-related subsystems.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT verify DOM availability or browser capability.
     * - Does NOT start observers or access the DOM.
     * - Does NOT mutate `lib` or global objects.
     *
     * OUTPUT GUARANTEES:
     * The returned object will always have the following shape:
     *
     *   {
     *     root: any|null,        // globalThis / window / global object
     *     window: any|null,      // window-like object
     *     document: any|null,    // document-like object
     *     baseURI: string|null   // base URI if available
     *   }
     *
     * Any property may be `null` if it cannot be resolved in the
     * current execution environment (e.g., non-browser contexts).
     *
     * @param {Object} inEnv
     *   Optional user-provided environment override.
     *   Non-object values are ignored.
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
     * - Establishes the canonical job-configuration policy used by the system.
     * - Does NOT load external configs; it only defines *whether/how* they are allowed
     *   and how they would be merged later.
     * - Ensures stable types and required keys for downstream consumers.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.job.config`)
     *   2) Default base config (`def_conf.job.config.base`)
     *   3) Explicit job config overrides (`user.job.config`)
     *      - This may override ANY field, including `base`
     *   4) Constants safety-net (applied only if required values are still missing)
     *
     * BASE CONFIG SEMANTICS:
     * - `job.config.base` is the lowest-precedence base object used during job
     *   configuration compilation.
     * - `user.job.config.base` (if provided) overrides the default base.
     *
     * SAFETY NET:
     * - Constants are the final fallback only (e.g., DOM_CONFIG_AT, DEFAULT_SELECTOR).
     * - Missing/invalid list fields are coerced to arrays and filtered to strings.
     * - Missing/invalid objects are coerced to hashes.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `job` and `job.config` are objects)
     * - Deterministic merge of user overrides into defaults
     * - Base config precedence handling (`job.config.base`)
     * - Normalization of list fields (`at`, `attrPrefixes`, `evalType`, `importPath`)
     * - Normalization of merge policy (`merge.order`, `merge.objects`, `merge.arrays`)
     * - Boolean normalization of `allowExternal`
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT parse or execute eval/import content
     * - Does NOT fetch or resolve imports
     * - Does NOT read DOM/script config sources
     * - Does NOT validate semantics beyond basic type/shape guarantees
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.job.config` will satisfy:
     *
     *   {
     *     allowExternal: boolean,     // defaults to true unless explicitly disabled
     *     at: string[],              // DSL pointers; never empty (constants fallback)
     *     attrPrefixes: string[],     // defaults to ["data-","at-"]
     *     evalType: string[],         // defaults to ["text/at-eval","text/at-config"]
     *     importPath: string[],       // defaults to []
     *     merge: {
     *       order: string[],          // defaults to ["base","external","inline"]
     *       objects: string,          // defaults to "deep"
     *       arrays: string            // defaults to "concatUnique"
     *     },
     *     base: Object                // always a hash/object
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

	// at pointers: default from constants.DOM_CONFIG_AT ("config.at at")
	out.at = lib.array.to(out.at, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.at))
            out.at = lib.array.to(CONSTANTS.DOM_CONFIG_AT, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");

	// attrPrefixes
	out.attrPrefixes = lib.array.to(out.attrPrefixes, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.attrPrefixes))
            out.attrPrefixes = ["data-", "at-"];

	// evalType
	out.evalType = lib.array.to(out.evalType, CONSTANTS.ARR_TO_OPTS).filter(v => typeof v === "string");
	if (!lib.array.len(out.evalType))
            out.evalType = ["text/at-eval", "text/at-config"];

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
     * OUTPUT GUARANTEES:
     * - `active.job.registry` is a hash
     * - `active.job.registry.prefix` is a non-empty string (defaults to "at")
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
     * CONTRACT:
     * - Mutates `active.boot` in-place.
     * - Defines ONLY boot-time behavior and initial runtime enablement.
     * - Does NOT start services, observers, events, or intervals.
     * - Does NOT manage runtime state after initialization.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.boot`)
     *   2) User-provided configuration (`user.boot`)
     *
     * SAFETY NET:
     * - Missing or invalid fields are replaced with safe defaults.
     * - Constants are used only as a final fallback.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `boot` is an object)
     * - Deterministic merge of user overrides
     * - Normalization of selector and boolean flags
     * - Establish initial runtime enablement intent
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute boot actions (sweep, observe, enable subsystems)
     * - Does NOT validate selector correctness beyond basic type checks
     * - Does NOT control runtime toggling after boot
     *
     * SEMANTICS:
     * - All boolean flags default to `true` unless explicitly disabled.
     * - `intervals` and `events` represent initial runtime state ONLY.
     *   They may be changed later via runtime APIs.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.boot` will satisfy:
     *
     *   {
     *     selector: string,      // non-empty, trimmed
     *     bootSweep: boolean,    // default true
     *     observeDom: boolean,   // default true
     *     intervals: boolean,    // initial enablement, default true
     *     events: boolean        // initial enablement, default true
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

	// merge user.boot over defaults (if provided)
	const userBoot = lib.hash.to(lib.hash.get(user, "boot"));
	active.boot = lib.hash.merge(active.boot, userBoot, CONSTANTS.MERGE_OPTS_V1);

	const boot = active.boot;

	// ---- final safety-net defaults (only if missing/invalid) ----

	// selector
	boot.selector = (typeof boot.selector !== "string" || !boot.selector.trim()) ?
	    CONSTANTS.DEFAULT_SELECTOR || "[data-activetag]":
	    boot.selector.trim();

	// bootSweep
	boot.bootSweep  = !lib.bool.no(boot.bootSweep);
	// observeDom
	boot.observeDom = !lib.bool.no(boot.observeDom);
	// initial runtime state flags (boot-time enablement only)
	boot.intervals  = !lib.bool.no(boot.intervals);
	boot.events     = !lib.bool.no(boot.events);
    }
    

    /**
     * Compile and normalize the `log` configuration block.
     *
     * CONTRACT:
     * - Mutates `active.log` in-place.
     * - Does NOT create or configure logger instances.
     * - Does NOT emit logs or perform side effects.
     * - Ensures a stable, predictable logging configuration object.
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.log`)
     *   2) User-provided configuration (`user.log`)
     *
     * SAFETY NET:
     * - Missing or invalid fields are replaced with sane defaults.
     * - Constants are used only as a final fallback.
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `log` and `log.policy` are objects)
     * - Deterministic merge of user overrides
     * - Boolean normalization using lib semantics
     * - Default policy completion
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT validate the full range of logging policies
     * - Does NOT bind to logging services or buckets
     * - Does NOT interpret or execute logging behavior
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.log` will satisfy:
     *
     *   {
     *     enabled: boolean,          // defaults to true
     *     policy: {
     *       console: string,         // defaults to CONSTANTS.LOG_POLICY.console ("warn")
     *       trace: boolean           // defaults to false
     *     }
     *   }
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
	    log.policy.console = lib.hash.get(CONSTANTS, "LOG_POLICY.console", "warn") ;
	

	// trace flag
	log.policy.trace = lib.bool.yes(log.policy.trace) ;
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
     * - Defines configuration for the DOM mutation observer service.
     * - Runtime enablement is controlled elsewhere (`boot.observeDom`).
     *
     * INPUT SOURCES (precedence, low → high):
     *   1) Default configuration (`def_conf.observe`)
     *   2) User-provided configuration (`user.observe`)
     *
     * RESPONSIBILITIES:
     * - Shape coercion (ensure `observe` is an object)
     * - Deterministic merge of user overrides
     * - Normalization of selectors and options
     * - Fallback to boot selector when selectors are omitted
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT start or stop observers
     * - Does NOT validate selector correctness
     * - Does NOT manage observer lifecycle
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.observe` will satisfy:
     *
     *   {
     *     selectors: string[],        // non-empty, defaults to boot.selector
     *     debounceMs: number,         // integer >= 0, defaults to 25
     *     observeAttributes: boolean  // defaults to false
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
	active.observe = lib.hash.merge(
            active.observe,
            userObserve,
            CONSTANTS.MERGE_OPTS_V1
	);

	const obs = active.observe;

	// selectors
	obs.selectors = lib.array
            .to(obs.selectors, CONSTANTS.ARR_TO_OPTS)
            .filter(v => typeof v === "string" && v.trim());

	if (!lib.array.len(obs.selectors)) {
            obs.selectors = lib.array.to(
		lib.hash.get(active, "boot.selector", CONSTANTS.DEFAULT_SELECTOR),
		CONSTANTS.ARR_TO_OPTS
            );
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
     * SEMANTICS:
     * - Engine configuration is layered:
     *     1) System/default engine config (`active.engine`)
     *     2) User-provided engine config (`user.engine`)
     * - User config overrides system config using MERGE_OPTS_V1.
     *
     * BUILTINS HANDLING (`engine.builtins`):
     * - Supports boolish semantics:
     *     - `false` / explicit opt-out => `{}` (disable all builtins)
     *     - `true`  => default builtins map
     *     - object  => merged with default builtins
     * - Builtins are filtered to function values only.
     * - Filtering is deep and compacted to remove empty containers.
     *
     * HOOKS HANDLING (`engine.hooks`):
     * - Provides a minimal, permissive instrumentation hook surface.
     * - Supports boolish semantics:
     *     - `false` / explicit opt-out => `{}` (disable all hooks)
     *     - `true`  => built-in test hooks (`testHooks`)
     *     - object  => merged with default hooks (functions only)
     * - Hooks are filtered to function values only.
     * - Hook filtering is shallow (hooks are not expected to be nested).
     *
     * RESPONSIBILITIES:
     * - Normalize system and user engine config blocks.
     * - Resolve and compile the `engine.builtins` surface.
     * - Resolve and compile the `engine.hooks` surface.
     * - Merge engine configuration layers deterministically.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute builtins or hooks.
     * - Does NOT validate hook names or builtin behavior.
     * - Does NOT require specific hooks/builtins to exist.
     * - Does NOT manage engine lifecycle or runtime state.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.engine` will be:
     * - a plain object
     * - containing:
     *     - `builtins`: a clean, nested hash of functions
     *     - `hooks`: a clean hash of functions
     * - both surfaces are safe for runtime invocation without additional type checks
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
     * SEMANTICS:
     * - If `layer` is an explicit opt-out (`lib.bool.no(layer)` or `layer === null`),
     *   return `{}` and ignore `base`.
     * - If `base` is truthy-yes, substitute `override`.
     * - If `layer` is truthy-yes, substitute `override`.
     * - Coerce both to hashes, merge base <- layer using MERGE_OPTS_V1.
     * - Filter result to function values only (optionally deep/compact).
     *
     * @param {*} base
     * @param {*} layer
     * @param {Object} override
     * @param {Object|boolean} [filterOpts]
     *   Passed through to `lib.hash.filter(..., fn, filterOpts)`.
     *   Use `true` for deep filtering of nested maps.
     *
     * @returns {Object}
     *   Hash of functions (possibly nested if deep filtering is enabled).
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
