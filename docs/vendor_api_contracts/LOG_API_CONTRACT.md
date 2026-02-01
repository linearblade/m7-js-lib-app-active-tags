# Log Primitive API Contract (m7-js-lib-primitive-log)

> **You may paste this file directly into another project so that an LLM knows how to correctly use the software.**
> This document defines the *public API contract only*. It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for **m7-js-lib-primitive-log**, including:

* `Manager` (bucket registry + routing layer)
* `Worker` (single-bucket log stream + storage/policy container)
* `Record` shape (strict `{ header, body }`)
* `auto.js` integration (optional m7-lib registration layer)

The goal is to allow correct integration and reasoning **without reading source code**.

---

## Core Concepts

### Buckets

A **bucket** is a named log stream.
* A `Manager` owns many buckets (Workers).
* A `Worker` owns exactly one bucket.

There is intentionally **no default bucket**. If you only want one bucket, instantiate a `Worker` directly. 

### Records

Workers store records in a strict `{ header, body }` shape:

* `header` is system-owned metadata
* `body` is user-owned payload (opaque)

The Worker generates these header fields:

* `at` — timestamp of this record
* `source` — Worker name
* `level` — severity (`log`, `info`, `warn`, `error`, …)
* `lastAt` — previous timestamp for this Worker (when available)
* `delta` — `at - lastAt` (when available)

Optional header fields when provided to `emit()`:

* `event`
* `trace` 

### Storage policy

A Worker stores records in-memory:

* `max === 0` → unlimited storage (append-only)
* `max > 0` → ring buffer that retains the most recent `max` records 

### Enable gates

* `Manager.enabled` is a **global forwarding gate**: when false, `manager.log/info/warn/error` return `null` and do not forward. It does **not** mutate existing Workers. 
* `Worker.enabled` is a **bucket gate**: when false, `emit()` returns `null`, no records are stored, no hooks run, nothing prints. 

### Console policy

Console output is **policy-controlled** and **best-effort**:

* Per-call printing can be suppressed with `opts.print === false`.
* Per-call console policy override: `opts.console`.
* Otherwise uses the Worker’s `console` policy.
* Printing eligibility is decided by `utils.shouldPrint(record, { console: policy })`.
* Printer errors are swallowed. 

### Hooks (best-effort)

Workers support optional user-defined handlers:

* `onEvent(record, worker, workspace)` — called after acceptance + storage
* `onPrint(record, ctx, workspace)` — called when a record is printed

Both are:
* synchronous
* best-effort (errors swallowed)
* never awaited 

---

## Module Exports

### Standard usage

In module/manual environments, `Manager` and `Worker` are the primary public constructors (exact export wiring depends on your entry module).

### auto.js integration exports

When using `auto.js` in a browser with **m7-lib**, it registers an object at:

* `lib.primitive.log` containing:
  * `Manager`
  * `Worker`
  * `utils`
  * `constants` 

---

## auto.js Integration Contract

### Purpose

When loaded in a browser environment with **m7-lib**, `auto.js` registers the primitive into `window.lib` at `lib.primitive.log`. 

### Preconditions

* Browser environment (has `window`)
* `window.lib` must exist
* `lib.hash.set` must be available 

### Failure behavior

If any precondition is missing, `auto.js` throws an Error at load time. 

### Non-goals

`auto.js` performs registration only; it does **not** change runtime behavior of capture. 

---

# Manager API

## Construction

### `new Manager(opts?)`

#### Options

* `name: string` (default `'log'`) — informational name
* `enabled: boolean` (default `true`) — Manager-level forwarding gate
* `throwOnError: boolean` (default `false`) — special `error()` behavior (see below)
* `worker: object` (default `{}`) — default Worker env config applied to **new** buckets only
* `buckets: object | null` — eager bucket map `bucketName -> Worker options` 

---

## Manager enable gate

### `manager.setEnabled(on = true)`
### `manager.enable()` / `manager.disable()`
### `manager.isEnabled() -> boolean` 

Guarantees:

* Disabling the Manager prevents forwarding to Workers.
* It does not mutate existing Workers or their defaults. 

---

## Worker defaults

### `manager.setWorkerConfig(cfg = {}) -> object`

Defines or updates the default Worker environment configuration used when creating new buckets.

* Does not affect already-created buckets. 

Supported keys (Worker environment defaults):

* `enabled`, `max`, `console`, `onEvent`, `clock`, `workspace`, `clone`, `onPrint` 

---

## Bucket management

Bucket name rules:

* Must be a non-empty string
* Finite numbers are accepted and coerced to strings (`0` → `'0'`)
* Other values are invalid 

### `manager.createBucket(name, opts?) -> Worker`

Creates (or replaces) a bucket.

Notes:

* Per-bucket `opts` override Manager Worker defaults.
* If a bucket already exists, it is replaced in the registry (no teardown is performed). 

### `manager.bucket(name) -> Worker | null`

Soft lookup (does not create missing buckets).

* Returns `null` if name is invalid or bucket missing. 

### `manager.ensureBucket(name, opts?) -> Worker`

Get-or-create lookup. 

### `manager.configureBucket(name, patch?) -> Worker | null`

Configures a bucket at runtime (creates the bucket if missing).

Notes:

* If bucket exists, patch is applied via `Worker.configure(patch)`.
* Some keys are creation-only (notably `clone`) and are ignored for existing buckets.
* If bucket is missing, `workspace` and `clone` are applied at creation time if present. 

### `manager.to(bucketName) -> Worker | null`

Alias of `manager.bucket(bucketName)`. 

---

## Logging API

All logging methods are **soft** operations:

* If `manager.enabled === false` ⇒ returns `null`
* If the bucket is missing/invalid ⇒ returns `null`
* Otherwise forwards to the Worker and returns the stored record 

### `manager.log(bucketName, data, opts?)`
### `manager.info(bucketName, data, opts?)`
### `manager.warn(bucketName, data, opts?)`
### `manager.error(bucketName, data, opts?)` 

#### `throwOnError` behavior (`manager.error`)

When `throwOnError === true`, `error()` throws after handling.

* If bucket missing/invalid: prints payload via `console.error` then throws.
* If bucket exists: records via Worker, suppresses Worker printing (avoid double-print), prints once via `console.error`, then throws an Error that includes:
  * `err.bucket`
  * `err.record` 

---

## Reading / clearing

### `manager.get(bucketName, filter = {}) -> Object[]`

* Validates bucketName (throws if invalid).
* If bucket missing, returns `[]`.
* Filter forwarded to `Worker.get(filter)`. 

### `manager.clear(bucketName?) -> void`

* If `bucketName` is null/undefined: clears all buckets.
* Otherwise clears only the named bucket (no-op if missing).
* Validates bucketName when provided (throws if invalid). 

### `manager.list() -> Array<Object>`

Returns an array of `Worker.stats()` snapshots. 

---

# Worker API

## Construction

### `new Worker(opts?)`

Options (selected highlights):

* `name: string` (default `'default'`) — stored as `record.header.source`
* `max: number|string|false|null|undefined` (default `0` unlimited; invalid values throw)
* `enabled: boolean` (default `true`)
* `console: number|string|boolean|null|undefined` — console policy
* `onEvent`, `onPrint` — best-effort hooks
* `clock` — time source (invalid values throw)
* `clone: boolean` (default `false`) — default per-record cloning policy
* `workspace: any` — opaque user workspace, passed into hooks/printers 

---

## Policy methods

### `worker.configure(patch = {}) -> void`

Patch keys:

* `enabled`, `max`, `console`, `onEvent`, `onPrint`, `clock`, `workspace`

Throws if patch is not an object, or if patched values are invalid. 

### `worker.setEnabled(on = true) -> void`

When disabled, `emit()` and storage drop records and return null. 

### `worker.setLogMax(value) -> void`

* `0`/falsy/`"0"` => unlimited
* positive integer => ring buffer size
* invalid values => throws
* truncates immediately if reducing below current size 

### `worker.truncate() -> void`

Enforces `max` against current storage.

* no-op when `max === 0`
* keeps most recent `max` when ring mode 

### `worker.setConsoleLevel(value) -> void`

Sets the console emission policy (normalized internally). 

---

## Emitting records

### `worker.emit(data, opts?) -> Object | null`

Behavior:

* If disabled → returns `null`
* Normalizes payload into `record.body`
* Builds a `{ header, body }` record with timing metadata
* Optionally clones body best-effort (per call or Worker default)
* Stores record (unlimited or ring)
* Fires `onEvent` best-effort
* Optionally prints best-effort 

`emit()` options:

* `level: string` (default `'log'`) → `record.header.level`
* `event: string` (optional) → `record.header.event`
* `trace: any` (optional) → `record.header.trace`
* `clone: boolean` (default Worker policy) → cloning override
* `print: boolean` (default `true`) → suppress printing if false
* `console: any` (default Worker policy) → console policy override 

### Convenience level wrappers

Thin wrappers around `emit()`:

* `worker.log(data, opts?)` → `level: 'log'`
* `worker.info(data, opts?)` → `level: 'info'`
* `worker.warn(data, opts?)` → `level: 'warn'`
* `worker.error(data, opts?)` → `level: 'error'` 

---

## Reading records

### `worker.get(filter?) -> Object[]`

Guarantees:

* Returned records are in chronological order (oldest → newest), regardless of internal storage mode. 

Special filters:

* `since: number (epoch ms)` → filters out records with `record.header.at < since`
* `limit: non-negative integer` → returns most recent `limit` after filtering
  * `limit: 0` returns `[]`
  * invalid `limit` throws 

Key routing rules:

* `"header.foo"` targets `record.header["foo"]` (literal key; no path traversal)
* `"body.bar"` targets `record.body["bar"]` (literal key; no path traversal)
* Bare keys:
  * known header fields (`at`, `source`, `level`, `event`, `trace`) target header
  * everything else targets body 

Value matching:

* Scalars use strict equality (`===`)
* Functions treated as predicates `(value, record) => boolean`
  * predicate errors swallowed and treated as non-match 

---

## Clearing records

### `worker.clear() -> void`

Clears stored records and resets internal storage counters, but `_lastAt` is intentionally preserved for timing continuity / async workflows. 

---

## Introspection

### `worker.stats() -> object`

Returns:

```js
{
  name: string,
  enabled: boolean,
  max: number,
  size: number,   // retained
  count: number,  // accepted since last clear
  ring: boolean   // max > 0
}
