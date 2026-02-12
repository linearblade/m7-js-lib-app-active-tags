// log/Manager.js
//
// Skeleton: log Manager (routes events to Workers/buckets + shared utilities).
// General-purpose (not ActiveTags specific).
//
// Responsibilities:
// - owns Worker registry
// - builds normalized record objects
// - console policy + printing (optional)
// - stack trace capture / pruning utilities
// - ergonomic helpers: info/warn/error/etc.
//
// Worker responsibilities:
// - per-bucket storage (ring/unlimited)
// - per-bucket enable/limits
// - per-bucket hooks

import Worker            from "./Worker.js";
//leave in the event I need it later
//import { CONSOLE_LEVEL } from './constants.js';
import utils             from './utils.js';

export default class Manager {
    /**
     * Create a Manager.
     *
     * Manager is a coordinator that owns a registry of named Worker instances
     * ("buckets") and provides shared defaults and policy used when creating
     * new buckets.
     *
     * Responsibilities:
     * - Maintain a Worker registry (`this.workers`)
     * - Provide shared defaults (enabled, console policy, hooks, clock, workspace)
     * - Provide a small facade API that forwards calls to specific buckets
     *
     * Notes:
     * - Manager does NOT auto-create buckets in `bucket()` / `to()` / log methods.
     * - If a bucket does not exist, log methods return `null` (or `[]` for `get()`).
     *
     * @param {Object} [opts]
     * @param {string} [opts.name='log'] Manager label/prefix for metadata.
     * @param {boolean} [opts.enabled=true] Master enable switch for Manager forwarding.
     * @param {number|string|boolean|null|undefined} [opts.console=CONSOLE_LEVEL.OFF]
     *        Default console policy applied to newly created Workers (unless overridden).
     * @param {Function|string|any} [opts.onEvent=null]
     *        Default hook applied to newly created Workers (unless overridden).
     *        Resolved via `utils._getFunction(...)`, which uses `lib.func.get` when available
     *        (but remains usable without `lib`).
     * @param {Function|any} [opts.clock=Date.now] Default clock applied to Workers.
     * @param {number} [opts.baseSkip=3] Stack skip depth baseline for trace utilities.
     * @param {RegExp|Function|null} [opts.prune=null] Optional stack prune rule.
     * @param {boolean} [opts.throwOnError=true]
     *        When true, `error()` throws after recording.
     * @param {Object} [opts.workspace]
     *        Default workspace object passed into Worker hooks/printers (unless overridden).
     * @param {Object<string, Object>} [opts.buckets]
     *        Map of `bucketName -> Worker options` used to pre-create Workers.
     * @param {boolean} [opts.clone=false]
     *        Default cloning policy applied to newly created Workers,
     *        unless overridden per bucket via `createBucket(name, { clone })`
     *        or per call via `emit(..., { clone })`.
     */
    constructor(opts = {}) {
	this.opts = opts;

	this.name = String(opts.name || "log");
	this.enabled = opts.enabled !== false;

	// normalize global console policy (stored here; enforced during emit)
	this.console = utils._normalizeConsoleLevel(opts.console);

	// global hook (supports lib.func.get when available)
	this.onEvent = utils._getFunction(opts.onEvent, "onEvent");

	// clock (strict)
	this.clock = utils._getClock(opts.clock);

	// stack handling
	this.baseSkip = Number.isFinite(opts.baseSkip) ? opts.baseSkip : 3;
	this.prune = opts.prune || null;

	this.throwOnError = opts.throwOnError !== false;

	this.workspace = (opts && typeof opts.workspace === "object" && opts.workspace)
	    ? opts.workspace
	    : {};
	//for avoidance of mutation in a bucket
	this.clone = opts.clone === true;
	
	/** @type {Map<string, Worker>} */
	this.workers = new Map();

	// install initial buckets
	const buckets = (opts.buckets && typeof opts.buckets === "object") ? opts.buckets : null;

	if (buckets) {
            for (const [bucketName, wopts] of Object.entries(buckets)) {
		this.createBucket(bucketName, wopts || {});
            }
	}

    }
    // ---------------------------------------------------------------------------
    // Bucket management
    // ---------------------------------------------------------------------------

    /**
     * Create (or replace) a Worker bucket.
     *
     * Merges Manager defaults into the Worker options unless explicitly overridden:
     * - `console`, `clock`, `enabled`, `onEvent`, `workspace`, `clone`
     *
     * Workspace precedence:
     * - If `opts` has an own `workspace` property (even if `undefined` or `null`),
     *   that value is used for the bucket.
     * - Otherwise Manager `this.workspace` is used.
     *
     * Clone precedence:
     * - If `opts` has an own `clone` property, that value becomes the bucket default.
     * - Otherwise Manager `this.clone` is used.
     *
     * Replacement behavior:
     * - If a bucket with the same name already exists, it is replaced in the registry
     *   via Map overwrite (no teardown of the previous Worker is performed).
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} name Bucket name (required).
     * @param {Object} [opts] Worker options override.
     * @returns {Worker} The created Worker instance.
     * @throws {Error} If `name` is invalid.
     */
    createBucket(name, opts = {}) {
	const key = utils.validateBucketName(name);

	// normalize clone explicitly (only true means true)
	const hasClone = ("clone" in opts);
	const clone =
              hasClone
              ? opts.clone === true
              : this.clone === true;

	const merged = Object.assign(
            {},
            {
		console: this.console,
		clock: this.clock,
		enabled: this.enabled,
		onEvent: this.onEvent,

		// defaults
		workspace: this.workspace,
		clone
            },
            opts,
            {
		// enforce name last
		name: key,

		// enforce precedence by key presence
		workspace: ("workspace" in opts) ? opts.workspace : this.workspace,
		clone
            }
	);

	const worker = new Worker(merged);
	this.workers.set(worker.name, worker);
	return worker;
    }
    /**
     * Get an existing Worker by name (soft lookup).
     *
     * This is an explicit lookup and does NOT create missing buckets.
     *
     * Behavior:
     * - Validates and normalizes the bucket name.
     * - If the name is invalid, returns `null` (does not throw).
     * - If the bucket does not exist, returns `null`.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values are treated as invalid.
     *
     * @param {string|number} name Bucket name.
     * @returns {Worker|null} The Worker instance, or null if invalid or not found.
     */
    bucket(name) {
	const key = utils.validateBucketName(name,false);
	if(!key) return null;
	return this.workers.get(key) || null;
    }


    /**
     * Get or create a Worker bucket.
     *
     * If the bucket does not exist, it is created via `createBucket(name, opts)`.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} name Bucket name (required).
     * @param {Object} [opts] Worker options used only if bucket must be created.
     * @returns {Worker} The existing or newly created Worker.
     * @throws {Error} If `name` is invalid.
     */
    ensureBucket(name, opts = {}) {
	const key = utils.validateBucketName(name);
	let w = this.workers.get(key);
	if (!w) w = this.createBucket(key, opts);
	return w;
    }

    /**
     * Configure a bucket at runtime (creates bucket if missing).
     *
     * If the bucket exists:
     * - Applies `patch` via `Worker.configure(patch)`.
     *
     * If the bucket does not exist:
     * - Creates it first, with workspace handling:
     *   - If `patch` has an own `workspace` property (even if `undefined`/`null`),
     *     that value is used during creation.
     *   - Otherwise uses Manager `this.workspace`.
     * - Then applies the full `patch` via `Worker.configure(patch)`.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} name Bucket name (required).
     * @param {Object} [patch] Worker configuration patch.
     * @returns {Worker} The configured Worker instance.
     * @throws {Error} If `name` is invalid.
     */
    configureBucket(name, patch = {}) {
	const key = utils.validateBucketName(name);

	// Detect explicit workspace override (even if undefined/null)
	const hasWorkspace =
              patch && typeof patch === "object" &&
              Object.prototype.hasOwnProperty.call(patch, "workspace");

	// Ensure bucket exists, passing workspace override only on creation
	const w = this.ensureBucket(
            key,
            hasWorkspace ? { workspace: patch.workspace } : {}
	);

	// Apply runtime patch to the worker (including workspace if provided)
	w.configure(patch);

	return w;
    }    
    // ---------------------------------------------------------------------------
    // Logging API (structured + optional console)
    // ---------------------------------------------------------------------------
    /**
     * Alias for `bucket(name)`.
     *
     * Behavior:
     * - Performs a soft lookup.
     * - Returns `null` if the bucket does not exist.
     * - Returns `null` if the bucket name is invalid.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values are treated as invalid.
     *
     * @param {string|number} bucketName Bucket name.
     * @returns {Worker|null} The Worker instance, or null if invalid or not found.
     */

    to(bucketName) {
	return this.bucket(bucketName);
    }

    /**
     * Forward a `log` record to an existing bucket.
     *
     * Behavior:
     * - If Manager is disabled => returns null
     * - If bucket does not exist => returns null
     * - Otherwise forwards to `Worker.log(data, opts)`
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} bucketName Existing bucket name.
     * @param {any} data Payload to log.
     * @param {Object} [opts] Forwarded to Worker.
     * @returns {Object|null} The stored record, or null if dropped/missing bucket.
     * @throws {Error} If `bucketName` is invalid.
     */
    log(bucketName, data, opts = {}) {
	if (!this.enabled) return null;
	const w = this._bucket(bucketName);
	if (!w) return null;
	return w.log(data, opts);
    }
    /**
     * Forward an `info` record to an existing bucket.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} bucketName Existing bucket name.
     * @param {any} data Payload to log.
     * @param {Object} [opts] Forwarded to Worker.
     * @returns {Object|null} The stored record, or null if dropped/missing bucket.
     * @throws {Error} If `bucketName` is invalid.
     */
    info(bucketName, data, opts = {}) {
	if (!this.enabled) return null;
	const w = this._bucket(bucketName);
	if (!w) return null;
	return w.info(data, opts);
    }
    /**
     * Forward a `warn` record to an existing bucket.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} bucketName Existing bucket name.
     * @param {any} data Payload to log.
     * @param {Object} [opts] Forwarded to Worker.
     * @returns {Object|null} The stored record, or null if dropped/missing bucket.
     * @throws {Error} If `bucketName` is invalid.
     */
    warn(bucketName, data, opts = {}) {
	if (!this.enabled) return null;
	const w = this._bucket(bucketName);
	if (!w) return null;
	return w.warn(data, opts);
    }
    /**
     * Forward an `error` record to an existing bucket.
     *
     * Behavior:
     * - If Manager is disabled => returns null
     * - If bucket does not exist => returns null
     * - Otherwise forwards to `Worker.error(data, opts)` and returns the stored record
     * - If `this.throwOnError` is true, throws after recording (and prints via `console.error`).
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} bucketName Existing bucket name.
     * @param {any} data Payload to log.
     * @param {Object} [opts] Forwarded to Worker.
     * @returns {Object|null} The stored record, or null if dropped/missing bucket.
     * @throws {Error} If `bucketName` is invalid.
     * @throws {Error} If `throwOnError` is enabled.
     */
    error(bucketName, data, opts = {}) {
	if (!this.enabled) return null;
	const w = this._bucket(bucketName);
	if (!w) return null;

	const rec = w.error(data, opts);

	if (this.throwOnError) {
	    console.error(rec);
            throw new Error(`[log] error(${bucketName}) (throwOnError enabled)`);
	}
	return rec;
    }
    
    // ---------------------------------------------------------------------------
    // Reading / clearing
    // ---------------------------------------------------------------------------
    /**
     * Retrieve stored records from an existing bucket.
     *
     * Note:
     * - This method validates the bucket name and will throw if invalid.
     * - If the bucket does not exist, returns an empty array.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} bucketName Existing bucket name.
     * @param {Object} [filter={}] Filter forwarded to `Worker.get(filter)`.
     * @returns {Object[]} Matching records; empty array if bucket does not exist.
     * @throws {Error} If `bucketName` is invalid.
     */
    get(bucketName, filter = {}) {
	const w = this._bucket(bucketName);
	if (!w) return [];
	return w.get(filter);
    }
    /**
     * Clear records.
     *
     * - If `bucketName` is null/undefined => clears all buckets.
     * - Otherwise clears only the named bucket (no-op if missing).
     *
     * Note:
     * - When clearing a specific bucket, the bucket name is validated and will throw if invalid.
     *
     * Bucket name rules (when `bucketName` is provided):
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number|null|undefined} bucketName Bucket name, or null/undefined for all.
     * @returns {void}
     * @throws {Error} If `bucketName` is provided but invalid.
     */
    clear(bucketName) {
	// if omitted => clear all
	if (bucketName == null) {
            for (const w of this.workers.values()) w.clear();
            return;
	}
	const w = this._bucket(bucketName);
	if (w) w.clear();
    }
    /**
     * List bucket stats for all registered Workers.
     *
     * @returns {Array<Object>} Array of `Worker.stats()` snapshots.
     */
    list() {
	const out = [];
	for (const w of this.workers.values()) {
            out.push(w.stats());
	}
	return out;
    }
    // ---------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------

    /**
     * Get an existing Worker by name (strict lookup).
     *
     * Internal variant of `bucket()` that enforces strict validation.
     *
     * Behavior:
     * - Validates and normalizes the bucket name.
     * - Throws if the name is invalid.
     * - Returns `null` if the bucket does not exist.
     *
     * Bucket name rules:
     * - Valid names are non-empty strings.
     * - Finite numbers are accepted and coerced to strings (e.g. `0` -> `"0"`).
     * - All other values throw.
     *
     * @param {string|number} name Bucket name.
     * @returns {Worker|null} The Worker instance, or null if not found.
     * @throws {Error} If `name` is invalid.
     */
    _bucket(name) {
	const key = utils.validateBucketName(name);
	return this.workers.get(key) || null;
    }

    

}
