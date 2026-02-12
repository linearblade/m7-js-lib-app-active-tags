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
