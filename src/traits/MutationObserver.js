import CONSTANTS         from '../constants.js';

export const trait_mutation_observer = {
    startObserver() {
	if (!this.lib) return;

	const obs = this.svc.domObserver;

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
	if (this.svc.domObserver) return;

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
	this.svc.domObserver = obs;

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
	if (this.svc.domObserver) return;

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
	
	this.svc.domObserver = new DomChangeObserver({
            root,
            selectors,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,
            debounceMs: observe.debounceMs || 0,
            onChange: (batch) => this._onDomChanges(batch),
	});

	this.svc.domObserver.start();
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
	if (!this.svc.domObserver) return;
	this.svc.domObserver.stop();
	this.svc.domObserver = null; // allow clean restart + GC
    },
    setObserverSelectors(selectors) {
	if (!this.svc.domObserver) return;
	this.svc.domObserver.setSelectors(selectors);
    }
};

export default trait_mutation_observer;
