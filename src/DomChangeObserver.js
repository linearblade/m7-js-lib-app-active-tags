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
