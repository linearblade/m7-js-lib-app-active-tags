/**
 * log/Worker.js
 * ------------
 * Worker represents a single log stream ("bucket") with its own:
 * - storage policy (unlimited or ring-buffer via `max`)
 * - enable/disable switch
 * - console emission policy (`console`)
 * - optional per-record hook (`onEvent`)
 * - optional printer implementation (`onPrint`)
 * - time source (`clock`)
 * - user workspace (`workspace`) injected into hooks/printers
 *
 * Worker responsibilities:
 * - normalize + emit records (via `emit()`) into a stable `{ header, body }` shape
 * - store records in-memory (unlimited array or ring buffer)
 * - expose retrieval APIs (`get`, `stats`)
 * - enforce bucket-level storage limits (`truncate`)
 * - dispatch `onEvent` best-effort after acceptance/storage
 * - optionally print records using `onPrint` or the default printer
 *
 * Record shape:
 * - `{ header, body }`
 * - `header` is system-owned metadata (e.g. `at`, `source`, `level`, `event`, `trace`)
 * - `body` is user-owned payload (opaque to Worker)
 */

import { CONSOLE_LEVEL } from './constants.js';
import utils             from './utils.js';
/**
 * Worker
 * ------
 * Per-bucket storage + policy container.
 *
 * Each Worker owns a single logical bucket (e.g. "net", "dom", "errors").
 */
export default class Worker {
    /**
     * Create a Worker.
     *
     * A Worker represents a single log stream with its own:
     * - in-memory storage policy (unlimited or ring buffer)
     * - enable/disable switch
     * - console emission policy
     * - optional event hook
     * - optional printer implementation
     * - clock source
     *
     * @param {Object} [opts]
     * @param {string} [opts.name='default']
     *        Logical name of this Worker (used as `record.header.source`).
     * @param {number|string|false|null|undefined} [opts.max=0]
     *        Maximum number of retained records.
     *        - falsy / 0 / "0" => unlimited storage
     *        - positive integer => ring buffer size
     *        - negative, float, or non-numeric values throw
     * @param {boolean} [opts.enabled=true]
     *        Master enable switch for this Worker. When false, emitted records are dropped.
     * @param {number|string|boolean|null|undefined} [opts.console]
     *        Console emission policy for this Worker.
     * @param {Function|string|any} [opts.onEvent=null]
     *        Optional per-record hook invoked after a record is accepted/stored.
     *        Signature: `(record, worker, workspace) => void`
     * @param {Function|string|any} [opts.onPrint=null]
     *        Optional printer implementation used for console output.
     *        Signature: `(record, ctx, workspace) => void`
     * @param {Function|any} [opts.clock=Date.now]
     *        Clock function returning epoch milliseconds. Invalid values throw.
     *
     * @param {boolean} [opts.clone=false]
     *        Default cloning policy for this Worker.
     *        When true, emitted record bodies are cloned best-effort before storage,
     *        unless overridden per call via `emit(..., { clone })`.
     *
     * @param {any} [opts.workspace]
     *        Optional user-defined workspace.
     *
     *        Workspace rules:
     *        - If `opts` has an own `workspace` key:
     *            - a plain object value becomes the workspace
     *            - any other value nukes the workspace to `{}`
     *        - If `opts` does not include `workspace`, the workspace defaults to `{}`.
     *
     *        The workspace is passed to:
     *        - `onEvent(record, worker, workspace)`
     *        - `onPrint(record, ctx, workspace)`
     */
    constructor(opts = {}) {
	this.name    = String(opts.name || "default");
	this.max     = utils._normalizeLogMax(opts.max);
	this.enabled = opts.enabled !== false;
	this.console = utils._normalizeConsoleLevel(opts.console);

	this.onEvent = utils._getFunction(opts.onEvent, "onEvent");
	this.onPrint = utils._getFunction(opts.onPrint, "onPrint");
	
	this.clock   = utils._getClock(opts.clock);

	// default cloning policy (per-call `opts.clone` may override)
	this.clone = opts.clone === true;
	
	// user-supplied workspace (opaque, user-owned)
	this.userWorkspace =
	    ("workspace" in opts)
            ? this._resolveWorkspace(opts.workspace)
            : {};

	// storage
	this._events = [];
	this._cursor = 0;
	this._count  = 0;
	this._lastAt = 0;
    }
    
    
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    /**
     * Set the console emission policy for this Worker.
     *
     * This policy is consulted by `emit()` when deciding whether a stored record
     * is eligible for printing. Printing can also be suppressed per-call via
     * `emit(..., { print: false })`, and the policy may be overridden per-call via
     * `emit(..., { console: <override> })`.
     *
     * @param {number|string|boolean|null|undefined} value
     * @returns {void}
     */

    setConsoleLevel(value){
	this.console = utils._normalizeConsoleLevel(value);
    }

    /**
     * Set the maximum retained record count for this bucket.
     *
     * - `0` / falsy / `"0"` => unlimited (no truncation required)
     * - positive integer   => ring buffer size (retain last N records)
     * - invalid values     => throws
     *
     * If reducing max below current stored size, truncates immediately to keep
     * the most recent entries and re-aligns ring cursor.
     *
     * @param {number|string|false|null|undefined} value
     * @returns {void}
     * @throws {Error} on invalid value
     */
    setLogMax(value){
        this.max = utils._normalizeLogMax(value);
        this.truncate();
    }


    /**
     * Enforce `this.max` against current storage.
     *
     * - No-op if `max === 0` (unlimited).
     * - If stored size exceeds max, keeps the most recent `max` records.
     * - Re-aligns ring cursor to a valid next-write position.
     *
     * @returns {void}
     */
    truncate(){
        // unlimited storage: nothing to do
        if (this.max === 0) return;

        const len = this._events.length;
        if (len <= this.max) return;

        // keep most recent `max` events
        this._events = this._events.slice(len - this.max);

	// reset ring cursor to a valid next write position (end of current list)
        this._cursor = this._events.length % this.max;
    }

    /**
     * Store a normalized record in this Worker.
     *
     * This is the internal storage primitive used by `emit()`.
     *
     * Behavior:
     * - If disabled (`enabled === false`) => returns null (dropped)
     * - If record is falsy => returns null
     * - Otherwise stores into unlimited or ring buffer depending on `max`
     * - Dispatches the per-bucket `onEvent` hook best-effort (hook errors swallowed)
     *
     * @param {{header: Object, body: any}} record
     *        A normalized log record.
     * @returns {Object|null} The stored record, or null if dropped.
     */
    _push(record) {
	// drop if disabled or no record
	if (!this.enabled) return null;
	if (!record) return null;

	// total count
	this._count++;

	// store (unlimited vs ring)
	const stored = (this.max === 0)
              ? this._pushUnlimited(record)
              : this._pushRing(record);

	// emit hook (best-effort)
	if (stored) this._dispatchOnEvent(stored);

	return stored;
    }
    /**
     * Retrieve stored records from this Worker, optionally filtered.
     *
     * Records are returned in chronological order (oldest → newest),
     * regardless of internal storage mode (unlimited array or ring buffer).
     *
     * Filtering:
     * - If `filter` is not an object (or is null), no key-based predicates are applied.
     *   Only special options (`limit`, `since`) may be consulted when present.
     *
     * Key routing:
     * - Explicit targeting:
     *   - `"header.foo"` → matches `record.header["foo"]` (literal key; no path traversal)
     *   - `"body.bar"`   → matches `record.body["bar"]` (literal key; no path traversal)
     * - Best-effort targeting (when no prefix is provided):
     *   - Known header fields (`at`, `source`, `level`, `event`, `trace`) match header
     *   - All other bare keys match body
     *
     * Value matching:
     * - Scalars compare via strict equality (`===`).
     * - Functions are treated as predicates: `(value, record) => boolean`
     *   Predicate errors are swallowed and treated as a non-match.
     *
     * Special filters:
     * - `since` : number (epoch ms)
     *     Filters out records whose `record.header.at` is less than `since`.
     * - `limit` : non-negative integer
     *     Limits the result to the most recent `limit` records after filtering.
     *     `limit === 0` returns `[]`.
     *
     * @param {any} [filter]
     * @returns {Object[]} Array of matching records.
     * @throws {Error} If `limit` is present but invalid (non-integer or negative).
     */
    get(filter = {}) {
	// limit: if provided, must be a non-negative integer
	let limit = null;
	if (filter && "limit" in filter) {
            const n = Number(filter.limit);
            if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
		throw new Error(`[log] invalid limit: ${filter.limit}`);
            }
            limit = n;
            if (limit === 0) return [];
	}

	// Optional range filter (lower bound on header.at)
	const since = Number.isFinite(filter?.since) ? filter.since : null;

	// Note: ring buffer is stored in overwrite order; we want chronological output.
	// If max > 0 and buffer is full, oldest item is at _cursor.
	let list;
	if (this.max > 0 && this._events.length === this.max) {
            const head = this._events.slice(this._cursor);
            const tail = this._events.slice(0, this._cursor);
            list = head.concat(tail);
	} else {
            list = this._events.slice();
	}

	// Known header fields (best-effort routing when caller omits header/body)
	const KNOWN_HEADER = new Set(["at", "source", "level", "event", "trace"]);

	const predicates = [];

	if (filter && typeof filter === "object") {
            for (const [rawKey, expected] of Object.entries(filter)) {
		if (rawKey === "limit" || rawKey === "since") continue;
		if (expected === undefined) continue;

		const key = String(rawKey);

		let where = null; // 'header' | 'body'
		let prop = null;

		// Only treat as namespaced if explicitly prefixed
		if (key.startsWith("header.")) {
                    where = "header";
                    prop = key.slice("header.".length); // literal key (no path traversal)
		} else if (key.startsWith("body.")) {
                    where = "body";
                    prop = key.slice("body.".length);   // literal key (no path traversal)
		} else {
                    // bare key (including keys containing dots)
                    prop = key;
                    where = KNOWN_HEADER.has(prop) ? "header" : "body";
		}

		const isFn = (typeof expected === "function");

		predicates.push((rec) => {
                    const container = rec && rec[where];
                    const value = container ? container[prop] : undefined;

                    if (isFn) {
			try {
                            return !!expected(value, rec);
			} catch {
                            return false;
			}
                    }

                    return value === expected;
		});
            }
	}

	// Apply filters
	let out = list.filter((rec) => {
            if (!rec) return false;

            // since => header.at lower bound
            if (since != null) {
		const t = Number.isFinite(rec?.header?.at) ? rec.header.at : null;
		if (t == null || t < since) return false;
            }

            for (const fn of predicates) {
		if (!fn(rec)) return false;
            }

            return true;
	});

	// Apply limit (take most recent `limit`)
	if (limit != null && limit > 0 && out.length > limit) {
            out = out.slice(out.length - limit);
	}

	return out;
    }
    
    /**
     * Clear all stored records for this bucket (dump the log).
     *
     * Resets:
     * - internal storage
     * - ring cursor
     * - accepted record count
     *
     * @returns {void}
     */
    clear() {
        this._events.length = 0;
        this._cursor = 0;
        this._count = 0;
    }

    
    /**
     * Return a snapshot of bucket state.
     *
     * @returns {{
     *   name: string,
     *   enabled: boolean,
     *   max: number,
     *   size: number,
     *   count: number,
     *   ring: boolean
     * }}
     */
    stats() {
	return {
	    name: this.name,
	    enabled: this.enabled,
	    max: this.max,
	    size: this._events.length,
	    count: this._count,
	    ring: this.max > 0,
	};
    }

    /**
     * Patch Worker policy at runtime.
     *
     * Intended keys (all optional):
     * - `enabled`   : boolean
     * - `max`       : number|string|falsy (see setLogMax)
     * - `console`   : number|string|boolean|falsy (see setConsoleLevel)
     * - `onEvent`   : function or lib-resolvable reference
     * - `onPrint`   : function or lib-resolvable reference
     * - `clock`     : function
     * - `workspace` : any
     *
     * Workspace semantics:
     * - If `patch` has an own `workspace` key:
     *     - a plain object value becomes the workspace
     *     - any other value nukes the workspace to `{}`
     * - If `workspace` is not provided, the workspace is unchanged.
     *
     * @param {Object} patch
     * @returns {void}
     * @throws {Error} on invalid values
     */
    configure(patch = {}) {
	if (!patch || typeof patch !== "object") {
            throw new Error("[log] Worker.configure expects an object");
	}

	if ("enabled" in patch) {
            this.enabled = !!patch.enabled;
	}

	if ("max" in patch) {
            this.setLogMax(patch.max);
	}

	if ("console" in patch) {
            this.setConsoleLevel(patch.console);
	}

	if ("onEvent" in patch) {
            this.onEvent = utils._getFunction(patch.onEvent, "onEvent");
	}

	if ("onPrint" in patch) {
            this.onPrint = utils._getFunction(patch.onPrint, "onPrint");
	}

	if ("clock" in patch) {
            this.clock = utils._getClock(patch.clock);
	}

	if ("workspace" in patch) {
	    this.userWorkspace = this._resolveWorkspace(patch.workspace);
	}
    }

    /**
     * Enable or disable this bucket.
     *
     * When disabled, `emit()` and `_push()` drop records and return null.
     *
     * @param {boolean} [on=true]
     * @returns {void}
     */
    setEnabled(on = true) {
	this.enabled = !!on;
    }

    // ---------------------------------------------------------------------------
    // Internals (storage primitives)
    // ---------------------------------------------------------------------------

    /**
     * Store a record in unlimited storage mode.
     * @private
     * @param {Object} record
     * @returns {Object} record
     */
    _pushUnlimited(record) {
        this._events.push(record);
        return record;
    }

    /**
     * Store a record in ring buffer mode.
     *
     * Invariant:
     * - `this.max` must be a positive integer (> 0) when this method is called.
     *
     * @private
     * @param {Object} record
     * @returns {Object} record
     * @throws {Error} if ring invariant is violated
     */
    _pushRing(record) {
        // invariant: ring mode implies max is a positive integer
        if (this.max <= 0) {
            throw new Error(`[log] Worker._pushRing invariant violation: max must be > 0 (got ${this.max})`);
        }

        if (this._events.length < this.max) {
            this._events.push(record);
            this._cursor = this._events.length % this.max;
            return record;
        }

        this._events[this._cursor] = record;
        this._cursor = (this._cursor + 1) % this.max;
        return record;
    }

    /**
     * Dispatch the per-bucket `onEvent` hook (best-effort).
     *
     * This is an observability hook invoked after a record has been accepted/stored.
     * Hook errors are swallowed so instrumentation cannot break logging.
     *
     * @private
     * @param {Object} record
     * @returns {void}
     */
    _dispatchOnEvent(record) {
	const fn = this.onEvent;
	if (!fn) return;

	try {
            fn(record, this, this.userWorkspace);
	} catch {
            // swallow
	}
    }

    // ---------------------------------------------------------------------------
    // Logging API (Worker-first)
    // ---------------------------------------------------------------------------
/**
 * Emit a log entry into this Worker.
 *
 * Steps:
 * - If disabled => returns null
 * - Normalize payload into a `{ header, body }` record via `utils.makeRecord`
 * - Include timing metadata:
 *   - `header.lastAt` and `header.delta` are populated when a previous timestamp exists
 * - Optionally clone the record body best-effort (to reduce mutation-by-reference)
 * - Store the record via `_push(record)`
 * - If console policy allows, print the record best-effort
 *
 * @param {any} data User payload (object becomes body; primitives become `{ value }`).
 * @param {Object} [opts]
 * @param {string} [opts.level='log'] Severity level stored in `record.header.level`.
 * @param {string} [opts.event] Optional event name stored in `record.header.event`.
 * @param {any}    [opts.trace] Optional trace payload stored in `record.header.trace`.
 * @param {Object} [opts.ctx] Optional context forwarded to printing.
 * @param {boolean} [opts.clone]
 *        When provided, overrides bucket default cloning behavior.
 *        If true, clones the record `body` best-effort before storage to reduce
 *        mutation-by-reference.
 * @returns {Object|null} The stored record, or null if dropped.
 */
    emit(data, opts = {}) {
	if (!this.enabled) return null;

	// header-owned level (default)
	const level = (opts && opts.level != null) ? opts.level : "log";

	// Build normalized record with header/body split
	const record = utils.makeRecord(data, {
            clock: this.clock,
            source: this.name,   // worker/logger name
            level,
            event: opts.event,
            trace: opts.trace,
	    lastAt: this.lastAt,
	    // avoid mutation as best as possible
	    clone:
            opts && "clone" in opts
		? opts.clone === true
		: this.clone === true
	});
	this._lastAt = record.header.at;
	// Store (_push fires per-bucket hook via _dispatchOnEvent)
	const stored = this._push(record);
	if (!stored) return null;

	// Console printing (explicit override -> worker default)
	const doPrint = (opts && opts.print === false) ? false : true;
	const consolePolicy = (opts && (opts.console !== undefined)) ? opts.console : this.console;
	if (doPrint && utils.shouldPrint(stored, { console: consolePolicy })) {
	    const printer = this.onPrint || utils.printRecord;

	    const ctx = {
		levelNum: utils.levelToConsoleLevel(stored.header.level),
		policy: utils._normalizeConsoleLevel(consolePolicy),
		CONSOLE_LEVEL
	    };

	    try {
		printer(stored, ctx, this.userWorkspace);
	    } catch {
		// never allow printing to break logging
	    }
	}
	return stored;
    }

    /**
     * Convenience: level='log'
     *
     * @param {any} data
     * @param {Object} [opts] Same as emit() opts (level is overridden)
     * @returns {Object|null}
     */
    log(data, opts = {}) {
	// opts is optional; avoid spreading non-objects
	const o = (opts && typeof opts === "object") ? opts : {};
	return this.emit(data, Object.assign({}, o, { level: "log" }));
    }

    /**
     * Convenience: level='info'
     *
     * @param {any} data
     * @param {Object} [opts] Same as emit() opts (level is overridden)
     * @returns {Object|null}
     */
    info(data, opts = {}) {
	const o = (opts && typeof opts === "object") ? opts : {};
	return this.emit(data, Object.assign({}, o, { level: "info" }));
    }

    /**
     * Convenience: level='warn'
     *
     * @param {any} data
     * @param {Object} [opts] Same as emit() opts (level is overridden)
     * @returns {Object|null}
     */
    warn(data, opts = {}) {
	const o = (opts && typeof opts === "object") ? opts : {};
	return this.emit(data, Object.assign({}, o, { level: "warn" }));
    }

    /**
     * Convenience: level='error'
     *
     * Note: Worker does not throw by default. Throw policy (if desired) belongs
     * to a higher-level coordinator (e.g., Manager facade).
     *
     * @param {any} data
     * @param {Object} [opts] Same as emit() opts (level is overridden)
     * @returns {Object|null}
     */
    error(data, opts = {}) {
	const o = (opts && typeof opts === "object") ? opts : {};
	return this.emit(data, Object.assign({}, o, { level: "error" }));
    }


    /**
     * Normalize a workspace value.
     *
     * Rules:
     * - valid => plain object (truthy, typeof "object", not Array)
     * - otherwise => {}
     *
     * Note: callers decide whether to apply this (i.e. only when key is present).
     *
     * @private
     * @param {any} value
     * @returns {Object}
     */
    _resolveWorkspace(value) {
	const isObj =
              value &&
              typeof value === "object" &&
              !Array.isArray(value);

	return isObj ? value : {};
    }
    
    
}
