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
     *     - Explicit opt-out on user layer (`false` / null) => `{}` (disable all hooks)
     *     - `true` on either layer => substitute built-in `testHooks`
     *     - object/other => coerced to hash and merged by layer (`user` wins)
     * - Final surface:
     *     - Filtered to function values only
     *     - Shallow filtering (not deep)
     *
     * OP-RESOLUTION HANDLING (`engine.opResolution`):
     * - Resolved via `_coerceOpResolution(...)`.
     * - Normalized fields:
     *     - `order`: allowed tokens are `"user"`, `"lib"`, and `"builtin"` only.
     *     - `auto`: defaults to `true` when omitted.
     * - Normalization semantics:
     *     - `order` entries are lowercased, filtered, and de-duplicated (stable).
     *     - empty/invalid `order` falls back to `["user", "lib", "builtin"]`.
     *
     * RESPONSIBILITIES:
     * - Normalize system and user engine config blocks.
     * - Resolve and compile the `engine.builtins` function surface.
     * - Resolve and compile the `engine.hooks` function surface.
     * - Resolve and normalize `engine.opResolution`.
     * - Merge engine configuration deterministically.
     *
     * NON-RESPONSIBILITIES:
     * - Does NOT execute builtins or hooks.
     * - Does NOT execute op lookups (compile-only policy normalization).
     * - Does NOT validate hook names or builtin behavior.
     * - Does NOT manage engine lifecycle or runtime state.
     *
     * OUTPUT GUARANTEES:
     * After execution, `active.engine` will:
     * - Be a plain object.
     * - Contain:
     *     - `builtins`: a (possibly nested) hash of functions only.
     *     - `hooks`: a hash of functions only.
     *     - `opResolution`: normalized `{ order, auto }` policy.
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

	// op-resolution policy (normalized runtime contract)
	const mOpResolution = this._coerceOpResolution(
            sysEngine.opResolution,
            userEngine.opResolution
	);
	
	// merge engine block (user overrides defaults)
	const merged = lib.hash.merge(sysEngine, userEngine, CONSTANTS.MERGE_OPTS_V1);
	
	// force compiled builtins result (post-merge)
	merged.builtins = mBuiltins;
	merged.hooks    = mHooks;
	merged.opResolution = mOpResolution;
	active.engine   = merged;
    }


    /**
     * Normalize and compile `engine.opResolution`.
     *
     * CONTRACT:
     * - Accepts system/base and user/layer values.
     * - Produces a normalized runtime policy object:
     *     `{ order: string[], auto: boolean }`
     * - Never throws for invalid user values; falls back to safe defaults.
     *
     * INPUT SEMANTICS:
     * - `base` and `layer` are hash-coerced and merged (`layer` wins).
     * - Only the keys `order` and `auto` are considered.
     *
     * NORMALIZATION:
     * - `order`:
     *     - normalized to array
     *     - tokens lowercased + trimmed
     *     - filtered to allowed values: `"user" | "lib" | "builtin"`
     *     - stable de-duplicated
     *     - fallback: `["user", "lib", "builtin"]` when empty/invalid
     * - `auto`:
     *     - if present, normalized via `lib.bool.yes(...)`
     *     - if absent, defaults to `true`
     *
     * @param {*} base
     *   System/default opResolution surface.
     *
     * @param {*} layer
     *   User/config opResolution override surface.
     *
     * @returns {{order: string[], auto: boolean}}
     *   Normalized op-resolution policy for VM lookup behavior.
     */
    _coerceOpResolution(base, layer) {
	const { lib } = this;

	const merged = lib.hash.slice(
            lib.hash.merge(
		lib.hash.to(base),
		lib.hash.to(layer),
		CONSTANTS.MERGE_OPTS_V1
            ),
            "order auto"
	);

	let order = lib.array.to(merged.order, CONSTANTS.ARR_TO_OPTS)
            .map(v => lib.str.to(v, true).trim().toLowerCase())
            .filter(v => v === "user" || v === "lib" || v === "builtin");

	if (!lib.array.len(order)) order = ["user", "lib", "builtin"];
	order = Array.from(new Set(order)); // stable de-dupe

	const auto = ("auto" in merged) ? lib.bool.yes(merged.auto) : true;

	return { order, auto };
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
