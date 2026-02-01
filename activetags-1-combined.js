

# --- begin: ActiveTags.js ---


import applyMixins from './helpers/applyMixins.js';
//import requireLibs from './helpers/requireLibs.js';
import trait_job  from './traits/job.js';
import trait_load  from './traits/load.js';
import trait_sweep  from './traits/sweep.js';
import trait_muta  from './traits/mutationObserver.js';
//import trait_diag  from './traits/diagnostics.js';
import trait_exp   from './traits/expressions.js';
import trait_cst   from './traits/constructor.js';
import Scheduler   from './class/Scheduler.js';
import CONSTANTS   from './constants.js';
import ExpressionResolver from './class/ExpressionResolver.js';
class ActiveTags {
    constructor(lib, conf = {}) {
	if (!lib) {
            throw new Error('[activeTags] constructor requires lib as first argument');
	}

	// allow helpers to assume this.lib exists
	this.lib = lib;
	
	// minimal require so we can normalize config
	lib.require.all(CONSTANTS.LIB_HASH, { mod: '[activeTags]' });

	// canonical config coercion
	conf = lib.hash.to(conf);

	lib.require.all(CONSTANTS.CORE_DEPS ,                    { mod: '[activeTags]' } );
	const svc = lib.require.service(CONSTANTS.CORE_SERVICES, { mod: '[activeTags]', returnMap: true } );
	// external managers (injected, non-owning)
	
	// now you can tie them to semantic slots safely
	this.delegator       = svc[CONSTANTS.SERVICE_DELEGATOR] || null;
	this.intervalManager = svc[CONSTANTS.SERVICE_INTERVAL] || null;
	this.logManager      = svc[CONSTANTS.SERVICE_LOG] || null;
	this.domObserver     = svc[CONSTANTS.SERVICE_OBSERVER] || null;

	this.expr = new ExpressionResolver({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    logger: this.logger,
	    env: { window, document }
	});

	

	// runtime state
	this.jobCounter = 0;
	this.jobsLegacy = {};

	// workspace + scheduler
	this.ws = new lib.primitive.workspace.WorkSpace();
	this.jobs = new Scheduler({ prefix: 'at' });

	// options (delegated)
	this.opts = this.getOpts(conf);
	this.conf = this.opts;


	const doc = lib.hash.get(lib, '_env.root.document');
	if (doc && doc.body) {
	    this.load();
	    this.startObserver();
	}
	
    }

    
    
    //cycles the jobs. if one is found with a status ready to start runs it. otherwise skips
    //at this point, the job can be set to inflight and ignored. controller will be set to job on startup, and it cna notify it on completion
    start(){ /*still undefined*/   }
    
    //employed by interval manager to periodically pickup new jobs automatically. may alternately utilize a dom observer to notice changes.
    sniffer(){
	/*
	//still undefined
	this.bootSweep() // runs on interval.
	*/
    }
}

applyMixins(ActiveTags, trait_job, trait_load, trait_sweep,  trait_muta, trait_exp,trait_cst);
export { ActiveTags };
export default ActiveTags;


# --- end: ActiveTags.js ---



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



# --- begin: class/ExpressionResolver.js ---

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

export class ExpressionResolver {


    constructor(opts = {}) {
	const lib = opts.lib;
	if (!lib) throw new Error("[ExpressionResolver] lib is required");

	this.lib = lib;
	this.toJob = opts.toJob || null;
	this.logger = opts.logger || null;

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
	    return custom[type](loc);
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
	//console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src)?lib.dom.get(parse.src, parse.prop):lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    }


    
    
}

export default ExpressionResolver;


# --- end: class/ExpressionResolver.js ---



# --- begin: class/Job.js ---

// Job.js
// ActiveTags Job: persistent binding to a DOM element + per-run context.
//
// Philosophy:
// - Job identity is stable (id, element, createdAt) and should be assigned by Scheduler.
// - Job config is usually snapshotted at register-time (ds).
// - A small set of fields can be refreshed from DOM per run (attr.action/method, etc).
// - Execution-specific state lives in job.run (ephemeral), not on the root job.

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

export default class Job {
    /**
 * Create a new Job instance.
 *
 * The constructor is intentionally minimal:
 * it wires required dependencies and establishes stable identity.
 * All DOM reading, configuration, and artifact derivation happens
 * later via `job.configure()`.
 *
 * @param {object} opts
 * @param {object} opts.lib            - m7 lib instance (required)
 * @param {ExpressionResolver} opts.expr
 *                                     - shared expression resolver (required)
 * @param {HTMLElement} opts.e         - DOM element backing this job (required)
 * @param {string} [opts.id]           - unique id assigned by Scheduler
 * @param {number} [opts.createdAt]    - timestamp assigned by Scheduler
 * @param {string} [opts.name]         - logical name; not guaranteed unique
 * @param {string} [opts.status]       - initial JOB_STATUS.* (default: READY)
 * @param {object} [opts.ws]           - persistent workspace root for this job
 * @param {object} [opts.intervals]    - per-job interval handles/locks (optional)
 */
    constructor(opts = {}) {
	if (!opts.lib) throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e) throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");

	this.lib = opts.lib;
	this.expr = opts.expr;
	this.e = opts.e;

	// identity (stable) — assigned by Scheduler (or null until registered)
	this.id = (typeof opts.id !== "undefined") ? opts.id : null;
	this.createdAt = (typeof opts.createdAt !== "undefined") ? opts.createdAt : Date.now();

	// optional: logical name (not guaranteed unique)
	this.name = (typeof opts.name !== "undefined") ? opts.name : null;

	// persistent per-job workspace root
	this.ws = opts.ws || {};

	// execution primitives / caches (legacy compatibility)
	this.stack = {};
	this.intervals = opts.intervals || {};

	// state
	this.status = opts.status || JOB_STATUS.READY;
	this.error = null;
	this.run = null;

	// internal flags
	this.flags = {
            attached: true,
            hasRun: false,
            artifactsBuilt: false,
            dirty: false,
	};
    }
    /**
     * Scheduler/runtime assigns identity after creation.
     * Useful when Job is created before registration.
     */
    setIdentity({ id, createdAt } = {}) {
	if (id != null) this.id = id;
	if (createdAt != null) this.createdAt = createdAt;
	return this;
    }

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

    endRun(status = JOB_STATUS.COMPLETE) {
	if (this.run) this.run.endedAt = Date.now();
	this.flags.hasRun = true;
	this.status = status;
	return this;
    }

    refreshFromDom(opts = {}) {
	const { action = true, method = true } = opts;
	if (action) this.attr.action = this.e.getAttribute("action");
	if (method) this.attr.method = this.e.getAttribute("method");
	return this;
    }

    updateDataset(nextDs = {}) {
	this.ds = nextDs || {};
	this.flags.dirty = true;
	return this;
    }

    setName(name) {
	this.name = name;
	if (this.ds && typeof this.ds === "object") this.ds.name = name;
	return this;
    }

    detach() {
	this.flags.attached = false;
	this.status = JOB_STATUS.DETACHED;
	return this;
    }

    /**
     * Shutdown this job.
     *
     * Semantically indicates that the job should no longer run.
     * For v1.0 this is a thin wrapper around `detach()`, but this
     * is the correct lifecycle choke point for future teardown:
     *
     * - cancel in-flight runs
     * - stop intervals
     * - release resources
     * - emit lifecycle events
     *
     * @param {Object} [opts]
     * @param {string} [opts.reason] Optional human-readable reason
     */
    shutdown(opts = {}) {
	// Idempotent: shutting down an already-detached job is a no-op
	if (this.flags && this.flags.attached === false) return;

	// Mark as detached / inactive
	if (typeof this.detach === "function") {
            this.detach(opts);
	} else {
            // fallback safety (should not happen)
            this.flags.attached = false;
            this.status = "detached";
	}

	// Optional bookkeeping
	if (opts.reason) {
            this.shutdownReason = opts.reason;
	}

	// Future:
	// - cancel intervals
	// - abort requests
	// - clear run state
    }

    toJSON() {
	return {
	    id: this.id,
	    name: this.name,
	    type: this.type,
	    status: this.status,
	    createdAt: this.createdAt,
	    flags: { ...this.flags },
	    ds: this.ds,
	    attr: this.attr,
	    load: this.load,
	    error: this.error ? String(this.error) : null,
	};
    }


    

    /**
     * Configure (or re-configure) this Job from its bound DOM element (this.e).
     *
     * v1.0 note:
     * This is a spiritual successor to legacy ActiveTags config shaping.
     * We preserve the *concept* (normalize + merge + derive + freeze),
     * but do not assume the old implementation model.
     *
     * Safe to call multiple times.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.readDom=true]   Re-read dataset/attrs from this.e before shaping.
     * @param {boolean} [opts.recompute=true] Recompute activeConf from inputs.
     * @param {boolean} [opts.rebuild=false]  Rebuild derived artifacts (stacks/intervals/pipelines).
     * @returns {Job}
     */
    
    
    configure(opts = {}) {
	// 0) Ensure we have a DOM element (or gracefully no-op)
	this._configureAssertElement(opts);

	// 1) Capture/refresh raw inputs from DOM (dataset + attrs) into job snapshots
	this._configureReadDomInputs(opts);
	this._configureReadAttrs(opts);
	
	// 2) Normalize inputs (inflate, legacy remaps, scalar coercions, etc.)
	this._configureNormalizeInputs(opts);

	// 3) Apply defaults + snapshot configEntry (page spec binding)
	this._getStoreConfigAt(opts);
	this._resolveConfigAt(opts);
	// 4) Merge precedence layers into activeConf
	//    (overrides > dataset > attrs > configEntrySnapshot > defaults)
	this._configureRecomputeActiveConf(opts);

	// 5) Derive/freeze creation-only artifacts (stackDefs/intervalDefs/pipelineDefs)
	this._configureDeriveArtifacts(opts);

	// 6) Finalize bookkeeping (flags, status, timestamps, debug)
	this._configureFinalize(opts);

	return this;
    }

    /* ------------------------------------------------------------
     * Private section methods 
     * ------------------------------------------------------------ */
    


    /**
     * Internal error helper.
     *
     * Centralized choke point for all Job errors.
     * Logging / telemetry may be added here later.
     *
     * @throws {Error}
     */
    _error(stage, code, message, meta = {}) {
	// If a real Error was provided, preserve it
	if (meta && meta.error instanceof Error) {
            meta.error.stage = stage;
            meta.error.code = code;
            meta.error.job = this;
            throw meta.error;
	}

	const err = new Error(message);
	err.stage = stage;
	err.code = code;
	err.job = this;
	err.meta = meta;

	throw err;
    }

    
    /**
     * Assert that this Job is bound to a valid DOM element.
     *
     * This is the first step of configuration and should fail fast
     * if the job is misconstructed or running in an invalid environment.
     *
     * @throws {Error} if no element is bound or element is not DOM-like
     */
    _configureAssertElement(opts = {}) {
	const [e, lib] = this.lib.hash.expand(this, "e lib");

	if (!e) {
            this._error(
		"configure",
		"NO_ELEMENT",
		"No DOM element bound to job"
            );
	}

	if (!lib.dom.is(e)) {
            this._error(
		"configure",
		"NOT_DOM",
		"Bound element is not a DOM element"
            );
	}
    }

    /**
     * Capture / refresh raw inputs from DOM into job snapshots.
     *
     * Step 1 of Job.configure():
     * - reads raw `data-*` attributes into this.ds (no inflate/remap here)
     * - delegates attribute capture
     */
    _configureReadDomInputs(opts = {}) {
	const [e, lib] = this.lib.hash.expand(this, "e lib");

	const readDom = (opts.readDom !== undefined) ? opts.readDom : true;
	if (!readDom) return;

	const rawData = lib.dom.filterAttributes(e, /^data-/, 1) || {};
	this.ds = rawData;
    }
    /**
     * Capture raw element attributes used as runtime inputs.
     *
     * Note:
     * - These are NOT treated as config.
     * - They are lightweight snapshots and may be re-read at runtime.
     */
    _configureReadAttrs(opts = {}) {
	const [e] = this.lib.hash.expand(this, "e");

	this.attr = {
            id: e.getAttribute("id"),
            name: e.getAttribute("name"),
            action: e.getAttribute("action"),
            method: e.getAttribute("method"),
            enctype: e.getAttribute("enctype"),
            // convenience metadata
            tagName: e.tagName
	};
    }

    
    /**
     * Normalize captured inputs.
     *
     * Step 2 of Job.configure():
     * - legacy remaps (old attribute names -> new schema)
     * - inflate flattened keys into nested objects (delim = '-')
     *
     * NOTE: Type coercion is intentionally deferred to merge/extraction,
     * where we have the full resolved config context.
     */
    _configureNormalizeInputs(opts = {}) {
	const [lib, ds] = this.lib.hash.expand(this, "lib ds");
	//this is more or less a no op. there if we try to back compat
	this._normalizeRemapLegacy(opts);
	this.ds = lib.hash.inflate(ds, { delim: "-" });
    }
    

    /* ------------------------------------------------------------
     * Deeper normalize steps (implement next; hard-fail if missing)
     * ------------------------------------------------------------ */
    /**
     * Legacy remap layer (minimal).
     *
     * v1.0 is not required to be backwards-compatible, but a small remap
     * here can reduce friction during migration without polluting the rest
     * of the pipeline.
     *
     * Runs BEFORE inflate (operates on raw `this.ds` keys like 'config-at').
     */
    _normalizeRemapLegacy(opts = {}) {
	const [ds] = this.lib.hash.expand(this, "ds");
	if (!ds) return;

	// If legacy `data-config="jobKey"` exists and `data-config-at` is missing,
	// treat it as config binding.
	if (typeof ds["config-at"] === "undefined" && typeof ds["config"] !== "undefined") {
            ds["config-at"] = ds["config"];
            // optional: keep legacy key or delete it; keep for debugging / transparency
            // delete ds["config"];
	}
    }
    
    

    /**
     * Resolve and snapshot config binding metadata.
     *
     * Step 3 of Job.configure():
     * - determines config binding location(s)
     * - normalizes to:
     *    - null
     *    - array of strings (from "a b c" or ["a","b"])
     *    - object/hash (from inflated keys like config.at.foo, config.at.bar)
     * - stores bookkeeping only (does not resolve configs)
     *
     * Examples:
     *   data-at="base shared featureA"        -> ["base","shared","featureA"]
     *   data-config-at="job.contactForm"      -> ["job.contactForm"]
     *   data-config-at-foo="1" data-config-at-bar="2"
     *                                         -> { foo: "1", bar: "2" }
     */
    _getStoreConfigAt(opts = {}) {
	const [lib, ds] = this.lib.hash.expand(this, "lib ds");

	let at = null;
	const dsConf = lib.hash.getUntilNotEmpty(ds, "config.at at", null);

	// Array form: accept as-is
	if (Array.isArray(dsConf)) {
            at = dsConf;

	    // Object/hash form: accept (e.g. inflated config.at.foo/bar)
	} else if (lib.utils.baseType(dsConf, "object")) {
            at = dsConf;

	    // String form: split into array
	} else {
            const s = lib.str.to(dsConf, true).trim();
            if (s) at = lib.array.to(s, /\s+/);
	}

	// Null out anything else (including empty array or empty string)
	if (!at) at = null;
	if (Array.isArray(at) && !lib.array.len(at)) at = null;

	// bookkeeping only
	this.configAt = at;

	return at;
    }
    /**
     * Resolve configAt into a single configEntrySnapshot.
     *
     * Policy:
     * - null: no snapshot
     * - object/hash: snapshot as-is
     * - array: resolve each ref and merge in order
     */
    _resolveConfigAt(opts = {}) {
	const [lib, at] = this.lib.hash.expand(this, "lib configAt");
	//console.log('trying to resolve ',at);
	// 1) Nothing to resolve
	if (!at) {
            this.configEntrySnapshot = undefined;
            return;
	}

	// 2) Inline config object (already resolved)
	if (!Array.isArray(at)) {
            if (!lib.utils.baseType(at, "object")) {
		this._error("configure", "CONFIG_AT_BAD_TYPE", "configAt must be an array, object, or null");
            }
            this.configEntrySnapshot = lib.hash.deepCopy(at);
            return;
	}

	// 3) Array of references
	if (!lib.array.len(at)) {
            this.configEntrySnapshot = undefined;
            this.configAt = null;
            return;
	}

	let merged = {};

	for (let i = 0; i < at.length; i++) {
            const ref = lib.str.to(at[i], true).trim();
            if (!ref) continue;

            const conf = this._resolveConfigTarget(ref, opts);

            if (!conf || !lib.utils.baseType(conf, "object")) {
		this._error("configure", "CONFIG_RESOLVE_FAILED", `Config reference '${ref}' did not resolve to an object`);
            }

            merged = lib.hash.merge(merged, lib.hash.deepCopy(conf));
	}

	this.configEntrySnapshot = merged;
    }
    
    /**
     * Resolve a single config reference to a config object.
     *
     * v1.0 policy:
     * - NO eval
     * - DOM payloads must be JSON (script/application-json, template text, etc.)
     *
     * @param {string} ref
     * @param {Object} [opts]
     * @returns {Object}
     */
    _resolveConfigTarget(ref, opts = {}) {
	const [lib, e] = this.lib.hash.expand(this, "lib e");

	ref = lib.str.to(ref, true).trim();
	if (!ref) {
            this._error("configure", "CONFIG_REF_EMPTY", "Empty config reference");
	}

	// Interpolate reference
	const scheme = this.expr.interpScheme({ e: e }, undefined);
	ref = lib.str.interp(ref, scheme);

	// Parse the target expression
	const info = this.expr.parseTarget({ e: e }, ref);

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

            const text =
		  lib.str.to(val.text, true) ||
		  lib.str.to(val.textContent, true) ||
		  lib.str.to(val.innerText, true) ||
		  "";

            if (!text.trim()) {
		this._error("configure", "CONFIG_DOM_EMPTY", `Config DOM source for '${ref}' had no text`);
            }
	    //re use later after we refactor that lib
            //val = lib.json.parse(text);
	    try {
		val = JSON.parse(text);
	    } catch (err) {
		this._error(
		    "configure",
		    "CONFIG_JSON_PARSE_FAILED",
		    `Invalid JSON in config payload for '${ref}'`,
		    { error: err }
		);
	    }
	}

	// Must resolve to an object/hash
	if (!val || !lib.utils.baseType(val, "object")) {
            this._error("configure", "CONFIG_NOT_OBJECT", `Config reference '${ref}' did not resolve to an object`);
	}

	return lib.hash.to(val);
    }    

    /**
     * Recompute activeConf by merging precedence layers.
     *
     * Step 4 of Job.configure():
     *   overrides > dataset > configEntrySnapshot > defaults
     *
     * Notes:
     * - Dataset (`ds`) represents declarative, per-element configuration
     *   sourced from `data-*` attributes.
     * - `ds.config` / `ds.at` are treated as *binding metadata only* and are
     *   removed before merging into activeConf.
     * - Attributes (`attr`) are intentionally excluded from this merge and are
     *   treated as runtime inputs, to be read and applied at execution time
     *   (e.g. form action/method/enctype).
     * - activeConf is a stable, merged configuration snapshot suitable for
     *   downstream extraction and artifact derivation.
     */
    _configureRecomputeActiveConf(opts = {}) {
	const [lib, ds] = this.lib.hash.expand(this, "lib ds");

	const defaults = this.defaults || {};
	const entry = this.configEntrySnapshot || {};
	const overrides = this.overrides || {};

	// Layer 1: defaults (lowest)
	let conf = lib.hash.deepCopy(defaults);

	// Layer 2: resolved config entry
	conf = lib.hash.merge(conf, lib.hash.deepCopy(entry));

	// Layer 3: dataset (minus binding metadata)
	let dsLayer = ds || {};
	if (dsLayer && typeof dsLayer === "object") {
            dsLayer = lib.hash.deepCopy(dsLayer);
            if (Object.prototype.hasOwnProperty.call(dsLayer, "config")) delete dsLayer.config;
            if (Object.prototype.hasOwnProperty.call(dsLayer, "at")) delete dsLayer.at;
	}
	conf = lib.hash.merge(conf, dsLayer);

	// Layer 4: overrides (highest)
	conf = lib.hash.merge(conf, lib.hash.deepCopy(overrides));

	this.activeConf = conf;
    }
    /**
     * Derive / freeze creation-only artifacts (stackDefs / intervalDefs / pipelineDefs).
     *
     * Step 5 of Job.configure():
     * - builds derived artifacts from activeConf
     * - freezes them so later stages (or user code) can't mutate them accidentally
     *
     * Policy:
     * - These are "creation-only" artifacts. Once set, we do not recompute unless:
     *   - opts.rebuild === true, OR
     *   - the artifact was never built.
     */
    _configureDeriveArtifacts(opts = {}) {
	const [lib, conf] = this.lib.hash.expand(this, "lib activeConf");

	const rebuild = !!opts.rebuild;

	// If already built and not rebuilding, do nothing.
	if (!rebuild) {
            if (this.stackDefs || this.intervalDefs || this.pipelineDefs) return;
	}

	// ---- Derive stack defs
	// Prefer injected derivation hooks (engine-owned), fallback to Job-private hooks.
	let stackDefs = null;
	if (typeof opts.deriveStacks === "function") {
            stackDefs = opts.deriveStacks(this, conf, opts);
	} else {
            stackDefs = this._deriveStackDefs(conf, opts);
	}

	// ---- Derive interval defs
	let intervalDefs = null;
	if (typeof opts.deriveIntervals === "function") {
            intervalDefs = opts.deriveIntervals(this, conf, opts);
	} else {
            intervalDefs = this._deriveIntervalDefs(conf, opts);
	}

	// ---- Derive pipeline defs
	let pipelineDefs = null;
	if (typeof opts.derivePipelines === "function") {
            pipelineDefs = opts.derivePipelines(this, conf, opts);
	} else {
            pipelineDefs = this._derivePipelineDefs(conf, opts);
	}

	// Snapshot + freeze (creation-only)
	this.stackDefs = this._freezeDeep(lib.hash.deepCopy(stackDefs || {}));
	this.intervalDefs = this._freezeDeep(lib.hash.deepCopy(intervalDefs || {}));
	this.pipelineDefs = this._freezeDeep(lib.hash.deepCopy(pipelineDefs || {}));

	// Optional bookkeeping flag (if you’re tracking it)
	if (this.flags) this.flags.artifactsBuilt = true;
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

    /* ------------------------------------------------------------
     * Deep freeze helper (creation-only artifacts should not mutate)
     * ------------------------------------------------------------ */

    _freezeDeep(v) {
	if (!v || typeof v !== "object") return v;

	// Freeze children first
	if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) {
		v[i] = this._freezeDeep(v[i]);
            }
            return Object.freeze(v);
	}

	for (const k in v) {
            if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
            v[k] = this._freezeDeep(v[k]);
	}

	return Object.freeze(v);
    }

    /**
     * Finalize bookkeeping after configuration.
     *
     * Step 6 of Job.configure():
     * - marks configured timestamps
     * - resets/sets flags
     * - ensures minimal runtime state containers exist
     */
    _configureFinalize(opts = {}) {
	const [lib] = this.lib.hash.expand(this, "lib");

	// Timestamps
	const now = Date.now();
	this.configuredAt = now;
	this.updatedAt = now;

	// Minimal runtime containers (safe to exist even if unused)
	if (!this.requests) this.requests = {};
	if (!this.ws) this.ws = {};

	// Flags / state
	if (!this.flags) this.flags = {};
	this.flags.configured = true;
	this.flags.dirty = false;

	// Status: keep stable; runner can transition from here
	if (!this.status) this.status = "ready";

	// Optional: stash last configure opts for debugging (cheap + helpful)
	if (opts && opts.debug) {
            this.lastConfigureOpts = lib.hash.deepCopy(opts);
	}
    }
    
}


# --- end: class/Job.js ---



# --- begin: class/Scheduler.js ---

// Scheduler.js
// Owns job IDs + job registry. Does NOT run stacks.


export const SCHED_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});

export default class Scheduler {
    constructor(opts = {}) {
	this.prefix = opts.prefix || "at";
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

    resolve(x) {
	return this._resolve(x);
    }
    
    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }

    hasElement(el) {
	return this.byEl.has(el);
    }

    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }

    getById(id) {
	return this.byId.get(id) || null;
    }

    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    list() {
	return Array.from(this.byId.values());
    }

    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    register(job) {
	if (!job || !job.e) throw new Error("[Scheduler] register(job) requires job.e");

	// Already registered element => return existing job
	const existing = this.getByElement(job.e);
	if (existing) return existing;

	// Ensure job has an id issued by scheduler
	if (!job.id) job.id = this.nextId();

	this.byId.set(job.id, job);
	this.byEl.set(job.e, job.id);
	this.createdAt.set(job.id, job.createdAt || Date.now());

	// Optional name index
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }


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
 
    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.name = name;
	this._indexName(name, job.id);
    }

    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }

    _resolve(x) {
	if (!x) return null;
	if (typeof x === "string") return this.getById(x);
	/*
	if (lib.dom.is(ref)) {
            return this.jobs.getByElement(ref) || undefined;
        }*/
	if (x.nodeType === 1) return this.getByElement(x); // element
	if (x.id && x.e) return x; // job-like
	if(x.e) return this.getByElement(x.e);

	return null;
    }

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


# --- end: class/Scheduler.js ---



# --- begin: constants.js ---

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
    CORE_SERVICES
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



# --- begin: traits/constructor.js ---

import requireLibs from '../helpers/requireLibs.js';

export const trait_constructor = {

    getOpts(conf) {
	const lib = this.lib;

	// clone via hash.to so we don't mutate caller
	const confObj = lib.hash.to(conf);
	delete confObj.intervalManager;
	delete confObj.logManager;

	return lib.hash.merge(
            {
		debug: false,
		log: { enable: false },
		observe: {
                    selectors: this.constructor.DEFAULT_SELECTOR,
                    debounceMs: 25,
                    observeAttributes: false
		}
            },
            confObj
	);
    },

    normalizeDelegator(lib) {
	if (!lib?.site) return;
	if (!lib.site.delegator && lib.site.delagator) {
            lib.site.delegator = lib.site.delagator;
	}
    },
    requireCoreDeps(lib) {
	requireLibs(lib, [
            'primitive.workspace',
            'dom',
            'site.delegator',
            'str.interp'
	], { mod: '[activeTags]' });
    }

};

export default trait_constructor;


# --- end: traits/constructor.js ---



# --- begin: traits/expressions.js ---

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


export const expressionsTrait = {



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
	//$fixup workspace to job compatibility hack
	if (lib.hash.is(job) && ('item' in job) && ('obj' in job)){
	    //console.log('legacy hack!');
	    job = job.item;
	}else job=this.toJob(job);

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
    },
    
    

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
	job = this.toJob(job);
	if(!target)return undefined;
	let splitter = function (str, exp=/\s+/,count=0){
	    str = lib.utils.toString(str,1);
	    let pos = str.indexOf(':');
	    return [str.substr(0,pos),pos>-1?str.substr(pos+1):undefined];

	};

	
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
		    src: window,
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
		    result = document.querySelector(loc);
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
	    return custom[type](loc);
	}else {
	    if (!(type in disp))type="inline";
	    return disp[type]();
	}
    },

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
    },


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
	//console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src)?lib.dom.get(parse.src, parse.prop):lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    },


    
    
};

export default expressionsTrait;


# --- end: traits/expressions.js ---



# --- begin: traits/job.js ---

export const trait_job = {
    toJob(ref) {
	return this.jobs.resolve(ref) || undefined;
    }
}

export default trait_job;


# --- end: traits/job.js ---



# --- begin: traits/load.js ---

import Job from '../class/Job.js';
import CONSTANTS from '../constants.js';
//REQUIRES STACK CONSTRUCTION AND INTERVAL STAGING STILL.
//RUNNER == requires a reset job.

/**
 * Load / Discovery Trait
 * ---------------------
 *
 * This trait defines the **DOM discovery and job registration layer** for
 * Active Tags. It is responsible for finding candidate DOM elements,
 * extracting configuration, and creating persistent `Job` instances
 * bound to those elements.
 *
 * Scope and responsibilities:
 * - Discover DOM elements via selectors or direct references
 * - Normalize and de-duplicate discovery results
 * - Extract and hydrate configuration from:
 *   - `data-*` attributes
 *   - External config sources (`data-config`)
 * - Preserve backward compatibility via legacy remapping hooks
 * - Instantiate and register `Job` objects in an idempotent way
 *
 * Explicit non-responsibilities:
 * - Does NOT execute, schedule, or run jobs
 * - Does NOT manage intervals or timers
 * - Does NOT perform DOM mutation
 * - Does NOT handle async flow or pipeline execution
 *
 * Architectural role:
 * - Acts as the "front door" of the Active Tags runtime
 * - Serves both initial page load and dynamic DOM discovery
 *   (e.g. MutationObserver-driven attachment)
 * - Provides a clean separation between:
 *     discovery  →  registration  →  execution
 *
 * Key methods:
 * - `load()`          : Public entry point for discovery + registration
 * - `bootSweep()`     : Pure DOM discovery (returns elements only)
 * - `registerJobs()`  : Job instantiation and registry (idempotent)
 * - `getDataset()`    : Dataset hydration (data-* + config)
 * - `getTagConfig()`  : External configuration resolution
 * - `remapLegacy()`   : Backward compatibility hook (no-op by default)
 *
 * Design notes:
 * - All methods in this trait are safe to call repeatedly.
 * - Job identity is bound to DOM elements.
 * - Execution is intentionally decoupled and handled by other traits
 *   (runner / scheduler / pipeline).
 *
 * This trait should remain:
 * - Deterministic
 * - Side-effect limited (registration only)
 * - Free of execution semantics
 */

// -----------------------------------------------------------------------------
// DEPENDENCIES / ASSUMPTIONS (to be satisfied by host ActiveTags class)
// -----------------------------------------------------------------------------
// This trait assumes the following exist on `this`:
//
// REQUIRED:
// - this.jobs
//     - .register(job)           // store job + assign id
//     - .getByElement(element)   // (optional but recommended for idempotency)
// - this.configureJob(job)       // minimal job shaping (no execution)
//
// REQUIRED (config / parsing):
// - this.interpScheme(ctx, ...)  // interpolation scheme for data-config
// - this.parseTarget(ctx, str)   // resolves data-config targets
//
// ENVIRONMENT:
// - Browser DOM (document, Element)
//
// NOTE:
// - This trait performs discovery + registration ONLY.
// - It does NOT run, schedule, or detach jobs.
// - Execution, lifecycle, and cleanup are handled elsewhere.
// -----------------------------------------------------------------------------



export const trait_load = {

    /**
     * Discover and register Active Tags jobs from the DOM.
     *
     * This is the primary public entry point for turning DOM elements into
     * registered `Job` instances. It performs **discovery + registration only**;
     * it does NOT execute, schedule, or run any jobs.
     *
     * Behavior:
     * - Delegates DOM discovery to `bootSweep()`
     * - Delegates job creation / deduplication to `registerJobs()`
     * - Idempotent: elements already associated with a Job will not create duplicates
     *
     * Accepted inputs:
     * - `null` / `undefined` → uses `ActiveTags.DEFAULT_SELECTOR`
     * - CSS selector string → `document.querySelectorAll(selector)`
     * - DOM Element → treated as a single candidate
     * - Array / array-like → mix of selectors and/or DOM elements
     *
     * Typical usage:
     * - Initial page load
     * - Manual re-scan of a subtree
     * - Observer-driven discovery (MutationObserver output)
     *
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *        Selector(s) or DOM element(s) to scan for Active Tags candidates.
     *
     * @returns {Job[]}
     *          Array of registered `Job` instances (new or existing).
     *
     * @sideEffects
     * - May create and register new Job instances
     * - Does NOT start, run, or schedule jobs
     *
     * @notes
     * - This method is safe to call repeatedly.
     * - Execution is intentionally decoupled and handled elsewhere (runner/pump).
     */
    
    load(sel=null,opts={}){
	const list = this.sweep(sel);
	if (!list) return;
	console.log(`found ${list.length} candidates`);
	const reg = this.registerJobs(list,opts);
	console.log(`registered ${this.lib.array.len(reg)} new jobs`);
    },




    /**
     * Create and register `Job` instances for discovered DOM elements.
     *
     * `registerJobs` is responsible for **job instantiation and registration only**.
     * It converts a list of candidate DOM elements into persistent `Job` objects
     * and stores them in the runtime job registry.
     *
     * This method:
     * - Is **idempotent** per DOM element
     * - Will NOT create duplicate jobs for the same element
     * - Will NOT execute, schedule, or start jobs
     * - Performs minimal, safe job configuration only
     *
     * Typical callers:
     * - `load()` after a DOM sweep
     * - MutationObserver change handlers
     * - Manual or programmatic attachment flows
     *
     * @param {Array<Element>|ArrayLike<Element>} list
     *        List of DOM elements returned from `bootSweep()` or similar discovery logic.
     *
     * @returns {Job[]}
     *          Array of registered `Job` instances.
     *          Existing jobs are returned as-is; new jobs are created and registered.
     *
     * @sideEffects
     * - Creates new `Job` instances when no existing job is associated with an element
     * - Registers jobs into the runtime job registry (`this.jobs`)
     *
     * @notes
     * - Job execution is intentionally decoupled and handled elsewhere.
     * - Job identity is bound to the DOM element (`job.e`).
     * - Initial job state is `{ status: 'ready' }`.
     */

    registerJobs(list,opts={}) {
	const lib = this.lib;
	const jobs = [];
	opts = lib.hash.to(opts,'ignoreExisting');
	list = lib.array.to(list);

	for (let i = 0; i < list.length; i++) {
            const tag = list[i];
            if (!lib.dom.is(tag)) continue;

            const existing = this.jobs.getByElement ? this.jobs.getByElement(tag) : null;
            if (existing) {
		if(!lib.bool.byIntent(opts.ignoreExisting) )
		    jobs.push(existing);
		continue;
            }

            const job = new Job({ lib: this.lib, expr: this.expr, e: tag, ws: {} });

            const registered = this.jobs.register(job);
            jobs.push(registered);

            registered.configure();
	}

	return jobs;
    },
    


    /**
     * Rewrite legacy `data-*` attributes into modern dataset shape.
     *
     * This hook exists to preserve backward compatibility with older
     * Active Tags markup and configuration conventions.
     *
     * It receives the raw dataset extracted from the DOM and may:
     * - Rename legacy keys
     * - Alias deprecated attributes
     * - Normalize values into modern formats
     * - Remove obsolete entries
     *
     * This method should be:
     * - Pure (no side effects)
     * - Deterministic
     * - Safe to call repeatedly
     *
     * @param {Object} filtered
     *        Raw key/value map produced by `lib.dom.filterAttributes()`.
     *
     * @returns {Object}
     *          Transformed dataset compatible with the current engine.
     *
     * @notes
     * - Default implementation is a no-op.
     * - Override or extend to support legacy markup versions.
     */
    remapLegacy(filtered) {
	return filtered;
    },

    /**
     * Build the hydrated dataset for a DOM element.
     *
     * `getDataset` is responsible for constructing the final configuration object
     * (`ds`) that drives a Job’s pipeline and execution behavior.
     *
     * It performs a multi-step normalization process:
     * 1. Extracts all `data-*` attributes from the element
     * 2. Applies legacy remapping (`remapLegacy`) for backward compatibility
     * 3. Merges in external configuration referenced by `data-config`
     * 4. Inflates dashed keys into nested object form
     *
     * Merge precedence:
     * - `data-*` attributes on the element override external config values
     *
     * This method:
     * - Does NOT create or register jobs
     * - Does NOT execute or schedule anything
     * - Is safe to call repeatedly
     *
     * @param {Element} tag
     *        DOM element from which configuration is extracted.
     *
     * @returns {Object}
     *          Hydrated dataset object used by the Job.
     *
     * @notes
     * - External config returned by `getTagConfig()` is expected to be in flat
     *   `data-*` form (pre-inflation).
     * - Nested runtime configuration is produced only after the merge step.
     * - Legacy compatibility should be handled exclusively via `remapLegacy()`.
     */
    
    getDataset(tag){
        let filtered = lib.dom.filterAttributes(tag, /^data-/,1);
        filtered = this.remapLegacy(filtered);
        let exConf = this.getTagConfig(tag) || {};
        let ds = Object.assign(exConf, filtered);
        //console.log(exConf,filtered,ds);
        ds = lib.hash.inflate(ds,"delim=-");

        return ds;
    },

    /**
     * Resolve and merge external configuration referenced by a tag's `data-config`.
     *
     * `data-config` may contain one or more whitespace-delimited "targets" that
     * resolve to configuration sources (e.g. DOM nodes, hashes, scalars). Each
     * target is interpreted, resolved, and merged into a single config object.
     *
     * Processing steps:
     * 1) Read `data-config` attribute value
     * 2) Interpolate it via `lib.str.interp()` using an interpolation scheme
     * 3) Split into targets (whitespace-delimited)
     * 4) For each target:
     *    - Resolve via `parseTarget({e:tag}, target)`
     *    - If target resolves to a DOM node:
     *        - Use `node.text` as the payload
     *        - If `node.type` contains "eval" → `eval(text)` to produce config
     *        - Else parse as JSON via `lib.json.parse(text)`
     *    - Merge each resolved config into an accumulator via `lib.hash.merge()`
     *
     * Return value is intended to be a plain object that can be merged with the
     * tag's `data-*` attributes before inflation in `getDataset()`.
     *
     * @param {Element} tag
     *        DOM element whose `data-config` attribute specifies external config sources.
     *
     * @returns {Object|undefined}
     *          Merged external configuration object, or `undefined` if `data-config`
     *          is empty / not provided.
     *
     * @sideEffects
     * - May evaluate arbitrary JavaScript if a DOM config source is marked with a
     *   type containing "eval" (e.g. `type="eval"`). This is powerful but unsafe
     *   for untrusted content.
     *
     * @notes
     * - This method does not read `data-*` attributes other than `data-config`.
     * - Merge order follows the order of targets in `data-config`.
     * - Values from the element's own `data-*` attributes override this output in
     *   `getDataset()` (via `Object.assign(exConf, filtered)`).
     */

    getTagConfig(tag){
	let target = tag.getAttribute('data-config');

	let scheme = this.interpScheme({e:tag},undefined);
        target = lib.str.interp(target, scheme);


	let element = undefined;
	if(lib.utils.isEmpty(target))return undefined;

	let list = lib.array.to(target, /\s+/);
	let data = {};
	for (let item of list){
	    let info =this.parseTarget({e:tag},item);
	    let val = lib.utils.isScalar(info) || lib.dom.is(info)?info:(lib.hash.is(info) && info.src && info.prop)?lib.hash.get(info.src,info.prop):info;
	    //console.log(`>>getconfig (${item})`,val);
	    let newData = undefined;
	    if (lib.dom.is(val)){
		let text = val.text;

		if ( (val.type+"").match('eval')){
		    //try to eval it
		    newData= eval(text);
		}else {
		    newData= lib.json.parse(text);
		    
		}
	    }
	    data = lib.hash.merge(data, lib.hash.to(newData));
	    
	}

	return data;
    }



    
};



export default trait_load;


# --- end: traits/load.js ---



# --- begin: traits/mutationObserver.js ---

import DomChangeObserver from '../class/DomChangeObserver.js';
import CONSTANTS         from '../constants.js';

export const trait_mutation_observer = {
    startObserver() {
	if (!this.lib) return;

	const obs = this.domObserver;

	if (!obs) {
            throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");
	}

	
	const lib = this.lib;
	const observe = lib.hash.get(this,'opts.observe',{});
	const selectors = lib.array.filterStrings( lib.hash.getUntilNotEmpty(observe, "selectors selector", CONSTANTS.DEFAULT_SELECTOR) );

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}


	// Selector-mode config only. No root. No global onChange.
	const selectorSpecs = selectors.map((selector) => ({
            selector,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,

            // Per-selector event handler (multi-consumer safe)
            onEvent: (batch) => this._onDomChanges(batch)
	}));

	obs.setSelectors(selectorSpecs);

	// Ensure observer is running (should be idempotent correct?)
	obs.start();

    },
    
    old2startObserver() {
	if (!this.lib) return;
	if (this.domObserver) return;

	const lib = this.lib;
	const observe = (this.opts && this.opts.observe) ? this.opts.observe : {};

	const selectors = lib.array.filterStrings(
            observe.selectors ??
		observe.selector ??
		CONSTANTS.DEFAULT_SELECTOR
	);

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const root =
              observe.root ||
              lib.hash.get(lib, "_env.root.document.body");

	if (!root) {
            throw new Error("[ActiveTags] Cannot start observer: no document.body");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}

	const obs = lib.service.get("primitive.dom.changeobserver");
	if (!obs) {
            throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");
	}

	// keep a local ref (so your other methods can use this.domObserver if they do)
	this.domObserver = obs;

	// Apply configuration (service instance is shared; be explicit)
	// Root is frozen SOT but changeable via setRoot()
	obs.setRoot(root);

	// debounce + onChange live on opts (not per-selector)
	obs.opts.debounceMs = observe.debounceMs || 0;
	obs.opts.onChange = (batch) => this._onDomChanges(batch);

	// Selector specs: make per-selector options explicit and stable
	const selectorSpecs = selectors.map((selector) => ({
            selector,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,
            // onEvent: optional per-selector event handler if you ever want it
	}));

	obs.setSelectors(selectorSpecs);

	// Start observing
	obs.start();
    },
    oldstartObserver() {
	if (!this.lib) return;
	if (this.domObserver) return;

	const lib = this.lib;
	const observe = (this.opts && this.opts.observe) ? this.opts.observe : {};

	const selectors = lib.array.filterStrings(
            observe.selectors ??
		observe.selector ??
		CONSTANTS.DEFAULT_SELECTOR
	);

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const root =
              observe.root ||
              lib.hash.get(lib, "_env.root.document.body");

	if (!root) {
            throw new Error("[ActiveTags] Cannot start observer: no document.body");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}
	
	this.domObserver = new DomChangeObserver({
            root,
            selectors,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,
            debounceMs: observe.debounceMs || 0,
            onChange: (batch) => this._onDomChanges(batch),
	});

	this.domObserver.start();
    },

    /**
     * Collect matching elements (roots + descendants) from a DomChangeObserver record list.
     *
     * Records are expected to be objects shaped like: { el: HTMLElement, selectors: string[] }
     *
     * @param {Array} records
     * @param {string} selector Comma-separated selector list for matches/querySelectorAll
     * @returns {HTMLElement[]}
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
    },

    _onDomChanges(batch) {
	const lib = this.lib;

	console.log("got a batch", batch);

	const parts = lib.hash.expand(batch || {}, "added changed removed changeAway");
	const added = parts[0] || [];
	const changed = parts[1] || [];
	const removed = parts[2] || [];
	const changeAway = parts[3] || [];

	const rawSelectors =
              lib.hash.get(this, "domObserver.opts.selectors") ||
              CONSTANTS.DEFAULT_SELECTOR;

	const selectors = lib.array.filterStrings(rawSelectors, { splitter: /\s+/ });
	if (!lib.array.len(selectors)) return;

	const selector = selectors.join(",");

	// add + changed => ensure jobs exist
	if (lib.array.len(added)) {
            const out = this._collectMatchingNodes(added, selector);
            if (out.length) this.registerJobs(out);
	}

	if (lib.array.len(changed)) {
            const out = this._collectMatchingNodes(changed, selector);
            if (out.length) this.registerJobs(out);
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
    },
    stopObserver() {
	if (!this.domObserver) return;
	this.domObserver.stop();
	this.domObserver = null; // allow clean restart + GC
    },
    setObserverSelectors(selectors) {
	if (!this.domObserver) return;
	this.domObserver.setSelectors(selectors);
    }
};

export default trait_mutation_observer;


# --- end: traits/mutationObserver.js ---



# --- begin: traits/sweep.js ---

import CONSTANTS from '../constants.js';
export const trait_sweep = {

    /**
     * Discover candidate DOM elements for Active Tags jobs.
     *
     * `bootSweep` is a **pure discovery utility**. It inspects the DOM based on the
     * provided input and returns a de-duplicated list of DOM elements that *may*
     * be eligible to become Jobs.
     *
     * This method:
     * - Accepts selectors and/or DOM elements
     * - Normalizes all inputs into a flat list
     * - De-duplicates results
     * - Does NOT create Jobs
     * - Does NOT mutate runtime state
     * - Does NOT schedule or execute anything
     *
     * It is intentionally "dumb" and side-effect free so it can be safely reused by:
     * - `load()` (initial scan)
     * - MutationObserver handlers (subtree discovery)
     * - Manual or programmatic re-scans
     *
     * Accepted inputs:
     * - `null` / `undefined` → uses `ActiveTags.DEFAULT_SELECTOR`
     * - CSS selector string
     * - DOM Element
     * - Array / array-like of selectors and/or DOM elements
     *
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *        Selector(s) or DOM element(s) used to discover candidate nodes.
     *
     * @returns {Element[]}
     *          De-duplicated array of DOM elements discovered by the sweep.
     *          Returns an empty array if no candidates are found.
     *
     * @notes
     * - Returned elements are *candidates only*; eligibility and job creation
     *   are handled by `registerJobs()`.
     * - This method is safe to call repeatedly and on arbitrary subtrees.
     */
    
    sweep(sel = null) {
	const input = sel ?? CONSTANTS.DEFAULT_SELECTOR;

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
	    // direct DOM element
	    if (lib.dom.is(t)) {
		push(t);
		continue;
	    }

	    // treat as selector
	    const selector = String(t ?? '').trim();
	    if (!selector) continue;

	    const nodes = document.querySelectorAll(selector);
	    for (const n of nodes) push(n);
	}

	if (out.length === 0) return [];
	return out;
    },

};

export default trait_sweep;


# --- end: traits/sweep.js ---

