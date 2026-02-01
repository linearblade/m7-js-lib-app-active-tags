import Job from '../class/job/Job.js';
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

enqueueAll() {
  const jobs = this.jobs.list();

  for (const job of jobs) {
    // enabled gate (matches your schema shape shown)
    const enabled = job?.config?.schema?.enable?.enabled;
    if (enabled === false) continue;

    // autorun list lives here in your example
    let autorun = job?.config?.schema?.enable?.autorun;

    // policy: if autorun is missing/null, do nothing (explicit only)
    if (!Array.isArray(autorun) || autorun.length === 0) continue;

    for (let key of autorun) {
      if (!key) continue;

      // "__DEFAULT__" -> "default"
      if (key === "__DEFAULT__") key = "default";

      this.engine.enqueue(job, key, {
        inputs: { reason: "boot" },
        meta: { source: "enqueueAll" },
      });
    }
  }
},

    
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
	    //console.log('setting name for',registered, registered.name);
	    this.jobs.setName(registered, registered.name);
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
