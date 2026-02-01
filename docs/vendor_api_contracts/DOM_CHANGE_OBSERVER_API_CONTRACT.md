# DomChangeObserver API Contract

**(m7-js-lib-primitive-dom-changeobserver)**

> **You may paste this file directly into another project so that an LLM can correctly reason about and use the software.**
> This document defines the **public API contract only**.
> It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for `DomChangeObserver`, including:

* construction and lifecycle
* selector registry behavior
* batch and record semantics
* handler guarantees
* data shapes
* error and environment guarantees
* optional `auto.js` integration behavior

This contract does **not** define:

* internal data structures
* private methods
* implementation optimizations
* undocumented side effects

---

## Core concepts

### Root

A **root** is the single DOM node whose subtree is observed.

Valid root types:

* `Element`
* `Document`
* `DocumentFragment`

Exactly one root is active at any time.

---

### Selector

A **selector** is a CSS selector string defining relevance.

Selectors:

* may be enabled or disabled
* may have locked, per-selector options
* participate only when enabled

---

### Lifecycle buckets

All reported changes are expressed in **four selector-relevant lifecycle buckets**:

* `added`
* `removed`
* `changed`
* `changeAway`

These buckets describe **selector membership transitions**, not raw DOM mutations.

---

## Fundamental guarantees

DomChangeObserver guarantees:

1. **Reporting-only behavior**  
   It reports DOM changes. It does not mutate state, attach jobs, or schedule work beyond batching.

2. **Selector relevance**  
   Only enabled selectors produce records.

3. **Explicit lifecycle buckets**  
   All output is expressed via `added`, `removed`, `changed`, `changeAway`.

4. **Batch-based delivery**  
   Changes are delivered in batches, never as raw MutationObserver records.

5. **Deterministic lifecycle**  
   Observation begins only after `start()` and ends after `stop()` or `pause()`.

---

## Module exports & integration

### Standard usage

The module exports the `DomChangeObserver` constructor.  
Exact export wiring depends on the entry module.

### `auto.js` integration (optional)

When used with **m7-lib**, `auto.js`:

* registers a namespace object via: `lib.hash.set(lib, "primitive.dom.changeobserver", {...})`
* registers a default singleton instance as a service under the key:  
  `"primitive.dom.changeobserver"`

`auto.js` **must not** alter runtime semantics defined by this contract.

---

## Public API surface

### Construction

#### `new DomChangeObserver(opts?)`

Construction does **not** start observation.

DOM access does not occur until `start()`.

---

## Lifecycle API

### `start() → true`

* Starts observation
* Idempotent
* Validates:
  * a valid root exists
  * `MutationObserver` is available

Throws on failure.

### `stop() → void`

* Disconnects observer
* Clears pending batches
* Cancels timers
* Preserves selectors and configuration

### `pause() → true`

* Stops observation
* Preserves pending batches

### `resume() → true`

Alias of `start()`.

### `state() → "running" | "paused"`

Returns lifecycle state.

### `isRunning() → boolean`

Returns whether observation is active.

---

## Root management

### `setRoot(newRoot, host?) → boolean`

* Replaces the active root
* Re-observes if currently running
* Resets selector membership baseline

Returns `false` if the root is unchanged.

Throws if `newRoot` is invalid.

---

## Configuration

### `configure(cfg) → this`

Applies global configuration **without changing the root**.

* `selectors` replaces the selector registry
* `root` is **forbidden** here

Throws if `cfg.root` is provided.

---

## Selector registry API

### `setSelectors(selectors) → void`

Hard reset:

* clears pending records
* resets selector stats
* resets membership baseline

### `addSelector(selector, opts?) → boolean`

Registers a selector.

Returns `false` if invalid or already present.

Options are locked at registration time.

### `removeSelector(selector) → boolean`

Removes selector and scrubs pending state.

### `pauseSelector(selector, opts?) → boolean`

Disables selector.

Optional: `opts.dropPending === true` drops pending records.

### `resumeSelector(selector) → boolean`

Re-enables selector.

### `setSelectorEnabled(selector, on) → boolean`

Hard enable/disable.

### `hasSelector(selector) → boolean`

Existence test.

### `getSelector(selector, opts?) → SelectorInfo | null`

Returns selector state and optional stats.

### `listSelectors(opts?) → SelectorInfo[]`

Lists all selectors and optional stats.

### `getSelectors() → string[]`

Returns the list of currently **enabled** selector strings.

### Convenience aliases

If present:

* `add(selector, onEvent?)`
* `remove(selector)`

Must behave identically to their canonical counterparts.

---

## Delivery & pull-style consumption

### `flush() → DomChangeBatch | null`

Immediately delivers pending records.

Cancels any debounce timer.

### `takePending() → DomChangeBatch | null`

Pull-style API:

* returns pending batch
* clears pending state
* does **not** invoke handlers

---

## Record semantics

### `added`

Element newly present in the subtree **and** matching one or more enabled selectors  
**at collection time** (during mutation processing).

Note: the implementation does not re-check selector matches at delivery time.

### `removed`

Element removed from the subtree **and** matching one or more selectors at removal time.

Best-effort.

Note: collection is performed during mutation processing; delivery may be deferred.

### `changed`

Selector membership transition:

* NOT matching → matching
* Caused by attribute changes
* Only when attribute observation is enabled

### `changeAway`

Selector membership transition:

* matching → NOT matching
* Caused by attribute changes
* Only when attribute observation is enabled

---

## Handler contract

### Global handler: `onChange(batch)`

* Fires for every delivered batch
* Synchronous
* Never awaited

### Per-selector handler: `onEvent(evt)`

* Fires only if selector has relevant records
* Fires **in addition** to `onChange`
* Receives selector-scoped lifecycle buckets

### Failure behavior

All handler failures are **swallowed**.

Observation must continue.

---

## Timing & ordering

* No strict ordering guarantee. Treat lifecycle arrays as sets.
* No ordering guarantee across batches
* Timestamps are informational only

---

## Environment requirements

Required:

* DOM environment with:
  * `MutationObserver`
  * `Element.prototype.matches`
  * `querySelectorAll`

Supported:

* Browsers
* jsdom

Not supported:

* Plain Node.js (no DOM)

---

## Data shapes (normative)

### `DomChangeRecord`

```ts
type DomChangeRecord = {
  el: Element
  selectors: string[]
}
```

### `DomChangeBatch`

```ts
type DomChangeBatch = {
  at: number
  selectors: string[]
  added: DomChangeRecord[]
  removed: DomChangeRecord[]
  changed: DomChangeRecord[]
  changeAway: DomChangeRecord[]
}
```

### `SelectorEvent`

```ts
type SelectorEvent = {
  at: number
  selector: string
  added: DomChangeRecord[]
  removed: DomChangeRecord[]
  changed: DomChangeRecord[]
  changeAway: DomChangeRecord[]
  batchAt: number
  enabledSelectors: string[]
}
```

### `SelectorStats`

```ts
type SelectorStats = {
  events: number
  matched: number
  added: number
  removed: number
  changed: number
  changeAway: number
  lastAt: number
}
```

### `SelectorInfo`

```ts
type SelectorInfo = {
  selector: string
  enabled: boolean
  stats?: SelectorStats
}
```

---

## Errors & throw behavior

Methods may throw only in these cases:

* `start()`:
  * invalid or missing root
  * missing `MutationObserver`
  * observer attachment failure

* `setRoot()`:
  * invalid root type

* `configure()`:
  * attempt to set `root`

* `stop()` / `pause()`:
  * disconnect failure (rare; best-effort wrapper)

If an error occurs during attachment, the observer must not claim to be running.

---

## Explicit non-guarantees

DomChangeObserver does **not** guarantee:

* capture of all attribute changes
* capture of text mutations
* stable identity across remove/reinsert
* real-time delivery
* delivery under catastrophic DOM failure

---

## Forward compatibility

Future versions may:

* extend selector options
* add metadata
* add optional delivery controls

Existing semantics will not be weakened.

---

## Philosophy

> **Observe precisely. Decide elsewhere.**

This contract exists to enforce that boundary.
