

# --- begin: ActiveTags.js ---

/*
  This file is part of M7.ORG/ACTIVE TAGS.

M7.ORG/ACTIVE TAGS is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

M7.ORG/ACTIVE TAGS is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with M7.ORG/ACTIVE TAGS. If not, see <https://www.gnu.org/licenses/>.
  
  v-1.0
  [ ] pass legacyremap or default function
  [ ] pass logger
  [ ] self definable stacks for non blocking process
  [ ] improve stack functionality
  [ ] chain requests from base object
  [ ] eject or stop processing on  setup errors
  [ ] setup configurable default settings on stack jobs
  
  
  V-0.9.9
  ---final---
  [/] this code base is a cluster fuck. clean it before switch over to 1.0
      --this is far improved. a litte more cleaning and check.
  [x] attempt to cut over to cleaner loop based flow processing for requests
  [/] intervals need to stop on error. figure out way to know when interval is running.
      --intervals also run the risk of clogging under slow network. figure out the correct way to streamline
      --(may already be doing it. need to double check)
  [x] pushStack() probably needs cleanup work
  [x] submitForm at very least needs to chain a second action. ideally make it configurable.
  [ ] trailing (leading as well?) space in data-response (chains) = has error
  [ ] no action in the form causes a form misconfiguration instead of no url defined.
  [ ] reset on form submit needs to be re tested.

  ---fix ups -- defaults no longer working.
  [x] fix default src for response  //$FIXUP -- seems already done?
  [x] urlencoded default settings.  //$FIXUP -- seems already done?

  V-0.9.7
  ---update--- :: both were working. broke in 9.8++ rework
  [x] allow form trigger events
      -allows submitForm only
  [x] process form trigger , then the form itself
  
  V-0.9.6
  ---update---
  [x] external config
  [x] intervals -- working, then re-borked in 0.9.8 - re enable.
  [x] extract hard coded input names from individual functions
  
  V-0.9.5
  ---important. ---
  [x] start logging flowControl
  [x] runqueue needs to be fully implemented on both sides. (errror / load)
  (test throw error in all circumstances ... tested request, on-submit, pre/post)
  [x] function hints (pointers for functions to find arguments)
  [/] finalize naming convention for inputs -- sort of fixed with dataset import and remap
  
  ---less important. still really useful. ---
  [x] integrate submit and load into same library.
  [x] decide how to reset or allow multuple runs
  [ ] setup stages of execution, so to prevent run runs without intending to
  [ ] add attribute data-max-tries --? what was this for?

  
  ---bonus todo---
  [x] reset function
  [ ] improve log() function
  [ ] improve log searching
  [x] investigate lib.func.get and see if you can pass a function name for anons (flow control);
  [x] disable logging or request attaching with debug
  

 */

import applyMixins from './helpers/applyMixins.js';
import requireLibs from './helpers/requireLibs.js';
import trait_load  from './traits/load.js';
import trait_muta  from './traits/mutationObserver.js';
//import trait_diag  from './traits/diagnostics.js';
import trait_exp   from './traits/expressions.js';
import Scheduler   from './class/Scheduler.js';

class ActiveTags {
    static DEFAULT_SELECTOR = '[class*=script-]';

    constructor(conf = {}) {
	const lib = conf.lib || (typeof window !== 'undefined' ? window.lib : null);
	this.lib = lib;

	requireLibs(lib, "data.ws.WorkSpace hash site.delagator str.interp", { mod: "[activeTags]" });

	if (!lib.site.delegator && lib.site.delagator) {
	    lib.site.delegator = lib.site.delagator;
	}

	this._log = [];
	this.intervals = {};
	this.jobCounter = 0;

	// legacy map (optional)
	this.jobs = {};

	this.ws = new lib.data.ws.WorkSpace();
	this.scheduler = new Scheduler({ prefix: "at" });

	const confObj = lib.hash.to(conf);
	delete confObj.lib;

	this.conf = lib.hash.merge(
	    { debug: false, log: { enable: false } },
	    confObj
	);
	this.domObserver = null;
	
	this.bootSweep();
	this.startObserver();
    }


    //defined in traits/load. sweeps dom for jobs and installs them
    //if new job is found, trigger a start
    bootSweep(){}

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

applyMixins(ActiveTags, trait_load, trait_muta, trait_exp);
export { ActiveTags };
export default ActiveTags;


# --- end: ActiveTags.js ---



# --- begin: auto.js ---

import ActiveTags from './ActiveTags.js';

const MOD = '[activeTags]';

// Browser + lib guard
const lib = (typeof window !== 'undefined' && window.lib) ? window.lib : null;

if (!lib) {
  throw new Error(`${MOD} requires window.lib (browser environment).`);
}

if (typeof lib?.hash?.set !== 'function') {
  throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

// Register into lib hierarchy (idempotent / overwrite-safe)
lib.hash.set(lib, 'site.activeTags', ActiveTags);

export { ActiveTags };
export default ActiveTags;


# --- end: auto.js ---



# --- begin: class/DomChangeObserver.js ---

// DomChangeObserver.js
// Reports DOM changes filtered by selector(s). No side effects beyond reporting.
//
//  Does: observe DOM + report changes for matching elements
//  Does NOT: attach jobs, run jobs, mutate app state, schedule work

export default class DomChangeObserver {
  /**
   * @param {Object} opts
   * @param {Element|Document} [opts.root=document.body] Root to observe
   * @param {string|string[]} [opts.selectors=[]] Selector(s) to match
   * @param {boolean} [opts.includeSubtreeMatches=true] If a node is added, also match descendants
   * @param {boolean} [opts.observeAttributes=false] Whether to observe attribute changes
   * @param {string[]} [opts.attributeFilter] Attribute names to observe (when observeAttributes=true)
   * @param {number} [opts.debounceMs=0] Batch/debounce delivery
   * @param {(batch: DomChangeBatch) => void} [opts.onChange] Callback for delivered batches
   */
  constructor(opts = {}) {
    this.opts = {
      root: (typeof document !== "undefined" ? document.body : null),
      selectors: [],
      includeSubtreeMatches: true,
      observeAttributes: false,
      attributeFilter: null,
      debounceMs: 0,
      onChange: null,
      ...opts,
    };

    this._selectors = this._normalizeSelectors(this.opts.selectors);
    this._observer = null;
    this._running = false;

    this._pending = {
      added: new Map(),      // el -> Set(selector)
      removed: new Map(),    // el -> Set(selector)
      changed: new Map(),    // el -> Set(selector) (attributes)
    };

    this._timer = null;
  }

  // ---------------------------
  // Public API
  // ---------------------------

  /** Update selectors at runtime. */
  setSelectors(selectors) {
    this._selectors = this._normalizeSelectors(selectors);
  }

  /** Start observing. Returns true if started. */
  start() {
    if (this._running) return true;
    if (typeof MutationObserver === "undefined") return false;

    const root = this.opts.root || (typeof document !== "undefined" ? document.body : null);
    if (!root) return false;

    this._observer = new MutationObserver((mutations) => this._onMutations(mutations));
    this._observer.observe(root, this._buildObserveOptions());

    this._running = true;
    return true;
  }

  /** Stop observing and clear pending batches. */
  stop() {
    if (this._observer) {
      try { this._observer.disconnect(); } catch {}
    }
    this._observer = null;
    this._running = false;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._clearPending();
  }

  /** Is it currently observing? */
  isRunning() {
    return this._running;
  }

  /**
   * Force-flush any pending changes now.
   * @returns {DomChangeBatch|null}
   */
  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    return this._deliverIfPending();
  }

  /**
   * Pull-style consumption: returns and clears any pending batch, without invoking onChange.
   * Useful if you want ActiveTags to poll changes rather than receive callbacks.
   * @returns {DomChangeBatch|null}
   */
  takePending() {
    const batch = this._buildBatchFromPending();
    if (!batch) return null;
    this._clearPending();
    return batch;
  }

  // ---------------------------
  // Private
  // ---------------------------

  _buildObserveOptions() {
    const o = {
      childList: true,
      subtree: true,
    };

    if (this.opts.observeAttributes) {
      o.attributes = true;
      if (Array.isArray(this.opts.attributeFilter) && this.opts.attributeFilter.length) {
        o.attributeFilter = this.opts.attributeFilter;
      }
    }

    return o;
  }

  _normalizeSelectors(sel) {
    if (!sel) return [];
    if (Array.isArray(sel)) return sel.filter(Boolean).map(String);
    return [String(sel)];
  }

  _onMutations(mutations) {
    if (!mutations || !mutations.length) return;
    if (!this._selectors.length) return; // nothing to match

    for (const m of mutations) {
      if (m.type === "childList") {
        for (const n of m.addedNodes || []) this._collectFromNode("added", n);
        for (const n of m.removedNodes || []) this._collectFromNode("removed", n);
      } else if (m.type === "attributes") {
        this._collectAttributeChange(m.target);
      }
    }

    this._scheduleDeliver();
  }

  _collectFromNode(kind, node) {
    if (!node || node.nodeType !== 1) return;

    // Match the node itself, and optionally its subtree
    this._matchElement(kind, node);

    if (this.opts.includeSubtreeMatches && node.querySelectorAll) {
      for (const sel of this._selectors) {
        let list;
        try { list = node.querySelectorAll(sel); } catch { continue; }
        for (const el of list) this._record(kind, el, sel);
      }
    }
  }

  _collectAttributeChange(target) {
    const el = target;
    if (!el || el.nodeType !== 1) return;

    // Only report attribute changes if element matches selectors
    for (const sel of this._selectors) {
      if (this._matches(el, sel)) this._record("changed", el, sel);
    }
  }

  _matchElement(kind, el) {
    for (const sel of this._selectors) {
      if (this._matches(el, sel)) this._record(kind, el, sel);
    }
  }

  _matches(el, sel) {
    try { return !!el.matches && el.matches(sel); } catch { return false; }
  }

  _record(kind, el, sel) {
    const map =
      kind === "added" ? this._pending.added :
      kind === "removed" ? this._pending.removed :
      this._pending.changed;

    let set = map.get(el);
    if (!set) {
      set = new Set();
      map.set(el, set);
    }
    set.add(sel);
  }

  _scheduleDeliver() {
    if (this._timer) return;

    const ms = Number.isFinite(this.opts.debounceMs) ? this.opts.debounceMs : 0;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._deliverIfPending();
    }, ms > 0 ? ms : 0);
  }

  _deliverIfPending() {
    const batch = this._buildBatchFromPending();
    if (!batch) return null;

    // Clear before calling user code to avoid re-entrancy weirdness
    this._clearPending();

    const cb = this.opts.onChange;
    if (typeof cb === "function") {
      try { cb(batch); } catch {}
    }

    return batch;
  }

  _buildBatchFromPending() {
    const hasAny =
      this._pending.added.size ||
      this._pending.removed.size ||
      this._pending.changed.size;

    if (!hasAny) return null;

    return {
      at: Date.now(),
      selectors: [...this._selectors],
      added: this._mapToRecords(this._pending.added),
      removed: this._mapToRecords(this._pending.removed),
      changed: this._mapToRecords(this._pending.changed),
    };
  }

  _mapToRecords(map) {
    const out = [];
    for (const [el, selectors] of map.entries()) {
      out.push({ el, selectors: [...selectors] });
    }
    return out;
  }

  _clearPending() {
    this._pending.added.clear();
    this._pending.removed.clear();
    this._pending.changed.clear();
  }
}

/**
 * @typedef {Object} DomChangeRecord
 * @property {Element} el
 * @property {string[]} selectors  // which selector(s) matched this element
 *
 * @typedef {Object} DomChangeBatch
 * @property {number} at
 * @property {string[]} selectors
 * @property {DomChangeRecord[]} added
 * @property {DomChangeRecord[]} removed
 * @property {DomChangeRecord[]} changed
 */


# --- end: class/DomChangeObserver.js ---



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
   * @param {object} opts
   * @param {HTMLElement} opts.e - DOM element backing this job
   * @param {string} [opts.id] - unique id assigned by Scheduler
   * @param {number} [opts.createdAt] - timestamp assigned by Scheduler
   * @param {object} [opts.ds] - dataset/config snapshot (object)
   * @param {object} [opts.attr] - attribute snapshot (action/method etc)
   * @param {string} [opts.type] - JOB_TYPE.*
   * @param {string} [opts.name] - logical name; may collide; not guaranteed unique
   * @param {string} [opts.status] - JOB_STATUS.*
   * @param {object} [opts.ws] - workspace root for this job (persistent)
   * @param {object} [opts.intervals] - per-job interval handles/locks (optional)
   */
  constructor(opts = {}) {
    if (!opts.e) throw new Error("[Job] missing required element (opts.e)");

    this.e = opts.e;

    // identity (stable) — assigned by Scheduler (or null until registered)
    this.id = opts.id ?? null;
    this.createdAt = opts.createdAt ?? Date.now();
    this.type = opts.type || JOB_TYPE.LOAD;

    // name (logical; not guaranteed unique)
    this.name = opts.name || null;

    // config snapshots
    this.ds = opts.ds || {};
    this.attr = opts.attr || {};

    // binding state (mutable)
    this.status = opts.status || JOB_STATUS.READY;
    this.load = 0; // legacy flag
    this.error = null;

    // execution primitives / caches
    this.stack = {};                 // existing engine expects this
    this.intervals = opts.intervals || {}; // optional per-job interval handles/locks
    this.ws = opts.ws || {};         // persistent per-job workspace root

    // per-run ephemeral state
    this.run = null;

    // internal flags
    this.flags = {
      attached: true,
      hasRun: false,
      stacksBuilt: false,
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

    unregister(jobOrIdOrEl) {
	const job = this._resolve(jobOrIdOrEl);
	if (!job) return false;

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
	if (x.nodeType === 1) return this.getByElement(x); // element
	if (x.id && x.e) return x; // job-like
	return null;
    }
}


# --- end: class/Scheduler.js ---



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
  const mod = opts.mod || '[requireLibs]';
  const allowFalsy = ('allowFalsy' in opts) ? !!opts.allowFalsy : true;

  if (root == null || (typeof root !== 'object' && typeof root !== 'function')) {
    throw new Error(`${mod} invalid root (expected object/function)`);
  }

  const list = Array.isArray(targets)
    ? targets
    : String(targets ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

  const outArr = [];
  const outMap = {};
  const missing = [];

  const getPath = (obj, path) => {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let ptr = obj;
    for (const key of parts) {
      if (ptr == null) return undefined;
      // Use `in` to allow properties with falsy values
      if (!(key in Object(ptr))) return undefined;
      ptr = ptr[key];
    }
    return ptr;
  };

  for (const path of list) {
    const val = getPath(root, path);

    const ok = allowFalsy
      ? !(val === undefined || val === null)
      : !!val;

    if (!ok) {
      missing.push(path);
      continue;
    }

    outArr.push(val);
    outMap[path] = val;
  }

  if (missing.length) {
    throw new Error(`${mod} missing required targets: ${missing.join(', ')}`);
  }

  return opts.returnMap ? outMap : outArr;
}

export default requireLibs;


# --- end: helpers/requireLibs.js ---



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



# --- begin: traits/load.js ---

import Job from '../class/Job.js';
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
    
    load(sel=null){
	const list = this.bootSweep(sel);
	return this.registerJobs(list);
    },


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
    
    bootSweep(sel = null) {
	const input = sel ?? this.constructor.DEFAULT_SELECTOR;

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
	    for (const n of lib.array.to(nodes)) push(n);
	}

	if (out.length === 0) return [];
	return out;
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

    

    registerJobs(list) {
	const jobs = [];

	// Normalize anything array-like (NodeList etc) into a real array
	list = lib.array.to(list);

	for (let i = 0; i < list.length; i++) {
	    const tag = list[i];
	    if (!lib.dom.is(tag)) continue;

	    // Idempotent: if this element already has a job, return existing
	    const existing = this.jobs.getByElement ? this.jobs.getByElement(tag) : null;
	    if (existing) {
		jobs.push(existing);
		continue;
	    }

	    // Minimal job construction (no running)
	    const ds = this.getDataset(tag) || {};
	    const attr = {
		action: tag.getAttribute('action'),
		method: tag.getAttribute('method'),
	    };

	    const job = new Job({
		e: tag,
		ds,
		attr,
		type: "load",
		status: "ready",
		ws: {},
	    });

	    // Minimal config shaping (still safe: no run)
	    this.configureJob(job);

	    // Scheduler assigns id + stores it
	    const registered = this.jobs.register(job);

	    jobs.push(registered);
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

export const trait_mutation_observer = {

    startObserver() {
	// idempotent
	if (this.domObserver) return;

	// allow: opts.observe.selector | opts.observe.selectors | default
	const observe = this.opts?.observe || {};

	// normalize to array of non-empty strings
	const selectors = (() => {
	    const raw =
		  observe.selectors ??
		  observe.selector ??
		  this.constructor.DEFAULT_SELECTOR;

	    const list = Array.isArray(raw)
		  ? raw
		  : String(raw || '').split(/\s*,\s*|\s+/);

	    return list.map(s => (s || '').trim()).filter(Boolean);
	})();

	this.domObserver = new DomChangeObserver({
	    root: observe.root || document.body,
	    selectors,
	    debounceMs: observe.debounceMs ?? 25,
	    observeAttributes: observe.observeAttributes ?? false,

	    // lexical capture avoids bind
	    onChange: (batch) => this._onDomChanges(batch),
	});

	this.domObserver.start();
    },

    _onDomChanges(batch) {
	// ---- ADD: attach new matching nodes (root + descendants) ----
	if (batch?.added?.length) {
	    // Prefer the observer’s active selectors (single source of truth)
	    const selectors = this.domObserver?.opts?.selectors || [this.constructor.DEFAULT_SELECTOR];
	    const selector = selectors.join(','); // querySelectorAll wants a selector list

	    const out = [];
	    const seen = new Set();

	    const push = (n) => {
		if (!n || n.nodeType !== 1) return; // Element only
		if (seen.has(n)) return;
		seen.add(n);
		out.push(n);
	    };

	    for (const rec of batch.added) {
		const root = rec?.el;
		if (!root || root.nodeType !== 1) continue;

		// include root itself if it matches
		if (root.matches?.(selector)) push(root);

		// include descendants that match
		const found = root.querySelectorAll?.(selector);
		if (found && found.length) {
		    for (const n of found) push(n);
		}
	    }

	    if (out.length) this.registerJobs(out);
	}

	// ---- REMOVE: TODO (needs detach API) ----
	// batch.removed gives you removed roots, but we need a deterministic cleanup path.
	// Leave for next pass.

	// ---- CHANGED: ignore for now (dirty config later) ----
    } ,
    
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

