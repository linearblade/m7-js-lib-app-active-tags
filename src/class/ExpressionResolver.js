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
import CONSTANTS from '../constants.js';
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
    
}

export default ExpressionResolver;
