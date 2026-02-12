// trait_observer.js
//
// MutationObserver trait for ActiveTags.
// - Public methods are documented and NOT prefixed with "_".
// - Private helpers are prefixed with "_" and should be treated as internal.
//
// Assumptions about ActiveTags host class:
// - this.bootSweep(selOrRoot) -> returns list of candidate elements (or jobs) to register
// - this.registerJobs(list)  -> installs jobs into registry
// - this.detach(target)      -> detaches a job by element/job/id (optional but recommended)
// - this.conf                -> merged config object
// - this.conf.observe        -> optional observer config (see defaults below)
// - this.selector (optional) -> default selector; fallback to ActiveTags.DEFAULT_SELECTOR
//
// If detach() does not exist yet, this trait will still attach new jobs,
// but removal cleanup will be a no-op (by design).

export const observerTraits = {
  // ---------------------------
  // Public API
  // ---------------------------

  /**
   * Start DOM observation.
   * @param {Object} [opts]
   * @param {Element|Document} [opts.root=document.body] - root to observe
   * @param {boolean} [opts.enable=true] - quick on/off
   * @param {boolean} [opts.observeAttributes=false] - watch attribute changes
   * @param {string[]} [opts.attributeFilter] - limit observed attributes
   * @param {boolean} [opts.autoAttach=true] - auto attach jobs on node additions
   * @param {boolean} [opts.autoDetach=true] - auto detach jobs on node removals (requires this.detach)
   * @param {number} [opts.debounceMs=0] - debounce reconcile bursts
   * @returns {boolean} true if observer started, false if not supported/disabled
   */
  observeStart(opts = {}) {
    const conf = this._observerConfig(opts);

    // hard disable
    if (!conf.enable) return false;

    // old browser fallback
    if (typeof MutationObserver === "undefined") {
      this._observerLog("warn", "MutationObserver not available; observer disabled.");
      return false;
    }

    // already running: restart if root changed
    if (this._observer && this._observerRoot) {
      if (conf.root && conf.root !== this._observerRoot) {
        this.observeStop();
      } else {
        return true;
      }
    }

    const root = conf.root || (typeof document !== "undefined" ? document.body : null);
    if (!root) return false;

    this._observerConf = conf;
    this._observerRoot = root;

    this._observer = new MutationObserver((mutations) => {
      try {
        this._observerOnMutations(mutations);
      } catch (err) {
        this._observerLog("error", `observer callback error: ${err?.message || err}`);
      }
    });

    this._observer.observe(root, {
      childList: true,
      subtree: true,
      ...(conf.observeAttributes
        ? {
            attributes: true,
            ...(Array.isArray(conf.attributeFilter) && conf.attributeFilter.length
              ? { attributeFilter: conf.attributeFilter }
              : null),
          }
        : null),
    });

    this._observerLog("info", "observer started");
    return true;
  },

  /**
   * Stop DOM observation and clear pending reconcile work.
   */
  observeStop() {
    if (this._observer) {
      try {
        this._observer.disconnect();
      } catch {}
    }
    this._observer = null;
    this._observerRoot = null;

    if (this._observerTimer) {
      clearTimeout(this._observerTimer);
      this._observerTimer = null;
    }

    this._pendingAdded = null;
    this._pendingRemoved = null;
    this._pendingAttr = null;

    this._observerLog("info", "observer stopped");
  },

  /**
   * Returns true if observer is active.
   */
  observeIsRunning() {
    return !!this._observer;
  },

  /**
   * Manual hook: if you have a custom DOM pipeline, call this with a subtree root.
   * This goes through the same attach path as observer additions.
   */
  observeReconcile(root) {
    if (!root) return [];
    // prefer existing bootSweep semantics (your engine already knows how to scan)
    const list = this.bootSweep(root);
    return this.registerJobs(list);
  },

  // ---------------------------
  // Private helpers
  // ---------------------------

  _observerConfig(override = {}) {
    // defaults: safe + minimal
    const base = (this.conf && this.conf.observe) ? this.conf.observe : {};

    // NOTE: we do NOT assume lib.hash.merge here; keep it plain.
    const conf = {
      enable: true,
      root: null,
      observeAttributes: false,
      attributeFilter: null,
      autoAttach: true,
      autoDetach: true,
      debounceMs: 0,
      // which selector counts as "candidate"
      selector: this.selector || (this.constructor && this.constructor.DEFAULT_SELECTOR) || "[class*=script-]",
      ...base,
      ...override,
    };

    // normalize
    if (!conf.root && typeof document !== "undefined") conf.root = document.body;
    conf.debounceMs = this._toInt(conf.debounceMs, 0);

    return conf;
  },

  _observerOnMutations(mutations) {
    if (!mutations || !mutations.length) return;

    const conf = this._observerConf || this._observerConfig();

    // collect changes
    const { added, removed, attrs } = this._observerCollectChanges(mutations);

    // fast exit
    if (!added.size && !removed.size && !attrs.size) return;

    // queue work (debounced)
    this._observerQueueWork({ added, removed, attrs, debounceMs: conf.debounceMs });
  },

  _observerCollectChanges(mutations) {
    const added = new Set();
    const removed = new Set();
    const attrs = new Set();

    for (const m of mutations) {
      if (m.type === "childList") {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n && n.nodeType === 1) added.add(n);
          }
        }
        if (m.removedNodes && m.removedNodes.length) {
          for (const n of m.removedNodes) {
            if (n && n.nodeType === 1) removed.add(n);
          }
        }
      } else if (m.type === "attributes") {
        if (m.target && m.target.nodeType === 1) attrs.add(m.target);
      }
    }

    return { added, removed, attrs };
  },

  _observerQueueWork({ added, removed, attrs, debounceMs }) {
    // accumulate across batches
    if (!this._pendingAdded) this._pendingAdded = new Set();
    if (!this._pendingRemoved) this._pendingRemoved = new Set();
    if (!this._pendingAttr) this._pendingAttr = new Set();

    for (const n of added) this._pendingAdded.add(n);
    for (const n of removed) this._pendingRemoved.add(n);
    for (const n of attrs) this._pendingAttr.add(n);

    // schedule flush
    if (this._observerTimer) return;

    const flush = () => {
      this._observerTimer = null;
      this._observerFlushWork();
    };

    if (debounceMs > 0) {
      this._observerTimer = setTimeout(flush, debounceMs);
    } else {
      // microtask-ish, avoids re-entrancy while staying snappy
      this._observerTimer = setTimeout(flush, 0);
    }
  },

  _observerFlushWork() {
    const conf = this._observerConf || this._observerConfig();

    const added = this._pendingAdded || new Set();
    const removed = this._pendingRemoved || new Set();
    const attrs = this._pendingAttr || new Set();

    this._pendingAdded = null;
    this._pendingRemoved = null;
    this._pendingAttr = null;

    // 1) auto-attach on added
    if (conf.autoAttach && added.size) {
      for (const node of added) {
        this._observerAttachFromNode(node, conf.selector);
      }
    }

    // 2) auto-detach on removed (optional; requires detach())
    if (conf.autoDetach && removed.size) {
      for (const node of removed) {
        this._observerDetachFromNode(node, conf.selector);
      }
    }

    // 3) attribute changes -> mark dirty or reattach (policy depends on you)
    // For now: if it *looks like* a candidate, attempt attach (idempotent if already exists).
    if (conf.observeAttributes && attrs.size) {
      for (const node of attrs) {
        this._observerAttachFromNode(node, conf.selector);
      }
    }
  },

  _observerAttachFromNode(node, selector) {
    // attach node itself if candidate
    if (this._observerIsCandidate(node, selector)) {
      const list = this.bootSweep(node);
      this.registerJobs(list);
      return;
    }

    // attach descendants that match selector
    if (!node.querySelectorAll) return;
    const matches = node.querySelectorAll(selector);
    if (!matches || !matches.length) return;

    // Use bootSweep for consistent dataset inflation / legacy mapping rules
    // If bootSweep expects a selector, it should accept a root element too per our runtime design.
    const list = this.bootSweep(node);
    this.registerJobs(list);
  },

  _observerDetachFromNode(node, selector) {
    if (typeof this.detach !== "function") return;

    // detach node itself if it is/was a job
    try {
      this.detach(node);
    } catch {}

    if (!node.querySelectorAll) return;

    // detach matching descendants
    const matches = node.querySelectorAll(selector);
    for (const el of matches) {
      try {
        this.detach(el);
      } catch {}
    }
  },

  _observerIsCandidate(node, selector) {
    if (!node || node.nodeType !== 1) return false;
    if (!selector) return false;
    try {
      return node.matches ? node.matches(selector) : false;
    } catch {
      return false;
    }
  },

  _observerLog(level, msg) {
    // keep logging non-invasive; integrate with your existing log system later
    if (this.conf?.debug) {
      const fn = console[level] || console.log;
      fn.call(console, `[activeTags][observer] ${msg}`);
    }
  },

  _toInt(val, fallback = 0) {
    const n = Number.parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  },
};

export default observerTraits;
