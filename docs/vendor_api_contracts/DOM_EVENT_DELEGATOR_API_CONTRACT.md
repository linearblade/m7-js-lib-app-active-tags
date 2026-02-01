# EventDelegator API Contract

**(m7-js-lib-primitive-dom-eventdelegator)**

> **You may paste this file directly into another project so that an LLM can correctly reason about and use the software.**
> This document defines the **public API contract only**.
> It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for `EventDelegator`, including:

* construction and lifecycle
* root and listener management
* handler registration and routing semantics
* propagation policy guarantees
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

A **root** is the single event target on which native listeners are attached.

Valid root types:

* any object implementing `addEventListener` / `removeEventListener` (typically `Document`, `Element`, `ShadowRoot`, or `DocumentFragment`)

Exactly one root is active at any time.

---

### Handler

A **handler** is a delegated event route defined by:

* event type
* selector
* handler function
* explicit policy options
* listener options
* optional tag

Handlers participate only while the delegator is running.

---

## Fundamental guarantees

EventDelegator guarantees:

1. **Routing-only behavior**  
   It routes events. It does not schedule async work, attach jobs, or manage application state.

2. **Single-listener consolidation**  
   At most one native listener is attached per `(event type + listener options bucket)` per root.

3. **Explicit selector routing**  
   Events are routed only when the selector match succeeds according to declared strategy.

4. **Declarative propagation policy**  
   `preventDefault` / `stopImmediatePropagation` are applied **only** when explicitly declared.

5. **Deterministic lifecycle boundaries**  
   Routing begins only after `start()` and ends after `stop()` / `pause()` / `dispose()`.

---

## Module exports & integration

### Standard usage

The module exports the `EventDelegator` constructor.

### `auto.js` integration (optional)

When used with **m7-lib**, `auto.js`:

* registers a namespace via: `lib.hash.set(lib, "primitive.dom.eventdelegator", {...})`
* registers a default singleton instance as a service under the key: `"primitive.dom.eventdelegator"`
* resolves a DOM `document` root (from `lib._env.root.document` or the realm host)
* creates an instance and attempts to set the root and start it (best-effort; failures are logged)

`auto.js` **must not** alter runtime semantics defined by this contract.

---

## Public API surface

### Construction

#### `new EventDelegator(config?)`

```js
const delegator = new EventDelegator({
  root: document,
  host,                 // optional
  callbackError,        // optional
  ...reserved           // ignored, stored
});
```

**Behavior**

* `root` is **optional** at construction.
  * If provided, `setRoot(root, host)` is invoked and will throw if the root is invalid.
  * `start()` throws if no root is configured.
* Construction does **not** attach listeners or route events until `start()`.
* Unknown config keys are accepted and stored for future use (but otherwise ignored).

**Throws**

* If `root` is provided, but invalid.

---

## Lifecycle API

### `start() → void`

* Attaches all required native listeners to the current root and begins routing.
* Idempotent (calling when already running is a no-op).
* May throw if listener attachment fails.
* Throws if no root is configured.

### `stop() → void`

* Detaches all currently attached native listeners from the root.
* Preserves registered handlers (routes remain registered).

### `pause() → void`

Alias of `stop()`.

### `resume() → void`

Alias of `start()`.

### `state() → "running" | "paused"` **until disposed**

Returns lifecycle state. After `dispose()`, state is undefined / not guaranteed.

### `isRunning() → boolean`

Returns whether routing is active.

---

## Root management

### `setRoot(newRoot, host?) → this`

* Replaces the active root.
* If currently running:
  * detaches listeners from the old root, then
  * re-attaches listeners to the new root.
* If `host` is provided (including `null`), it is forwarded to `setHost(host)`.

**Throws**

* If the instance is disposed.
* If `newRoot` is missing or invalid (must implement `addEventListener/removeEventListener`).

---

## Host & error policy

### `setHost(host) → this`

Sets or replaces the host environment surface.

**Accepted values**

* `null` / `undefined` → clears the host.
* an `object` or `function` (but **not** an Array) → stored as the host after validation.

**Validation**

If `host` is provided (non-null), and any of the following properties exist on it, they **must** be functions:

* `host.matches`
* `host.closest`
* `host.getPath`
* `host.validateSelector`
* `host.onError`

**Throws**

* If called after `dispose()`.
* If `host` is provided but is not an object/function, or is an Array.
* If any provided capability is present but not a function.



### `setCallbackError(fn?) → this`

Sets handler error policy.

**Accepted values**

* `fn === undefined` → restores default policy (`(msg, err) => console.error(msg, err)`).
* `fn === null` → swallow handler errors silently.
* `typeof fn === "function"` → use `fn` as the policy.

**Callback signature**

When a delegated handler throws, the policy function is invoked as:

```ts
fn(message: string, error: unknown, context: {
  eventType: string;
  selector: string;
  event: Event;
  matched: Element;
}): void
```

The delegator never lets errors thrown by the policy escape (policy failures are swallowed).

**Throws**

* If called after `dispose()`.
* If `fn` is provided but is not a function, `null`, or `undefined`.


---

## Handler registry API

### `on(spec) → () => void`

Registers a delegated handler and returns an **unsubscribe** function.

```js
const off = delegator.on({
  eventType: "click",
  selector: ".btn",
  handler(evt) {
    // `this` is the element that matched the selector
  },
  options: { capture: false, passive: false, once: false },
  policy: { match: "closest", prevent: false, stop: false },
  tag: "ui"
});

// later
off();
```

Notes:

* Handlers registered while the delegator is running will cause the relevant native listener
  to be created/attached as needed.

---

### `set(spec) → () => void`

Registers a delegated handler with **replace semantics** for the selector **within a bucket**.

* The bucket is `(eventType + options)`.
* This overwrites the entire handler group for the given `selector` in that bucket.
* Returns an unsubscribe function (equivalent to calling `off(...)` with the same parameters).

---

### `off(spec) → void`

Removes handlers matching the given spec.

```js
delegator.off({
  eventType: "click",
  selector: ".btn",
  handler,          // optional
  options,          // optional (bucket selector)
  tag               // optional
});
```

Removal semantics:

* If neither `handler` nor `tag` is provided: removes **all** handlers for that `(eventType + options + selector)` route.
* If `handler` is provided: removes only handlers whose function equals `handler`.
* If `tag` is provided: removes only handlers whose tag equals `String(tag)`.
* If both `handler` and `tag` are provided: removes only those matching both.

Best-effort: if the target bucket/route does not exist, `off()` is a no-op.

---

### `offTag(tag) → void`

Removes **all handlers** associated with a given tag across all event types and options buckets.

`tag` is compared as `String(tag)`.

---

### `clear(eventType?) → void`

* If `eventType` is provided: clears all handlers for that event type and detaches any native listeners for that type.
* If omitted: clears **all handlers** and detaches **all native listeners**.

---

### Introspection

#### `list(eventType?) → Array<RouteInfo>`

Returns a snapshot of registered routes.

If `eventType` is provided, returns only that event type’s routes.

`RouteInfo` shape:

```ts
type RouteInfo = {
  eventType: string;
  selector: string;
  count: number;          // number of registered handlers for that selector in the bucket
  tags: string[];         // unique tags present (empty if none)
  tagCounts: Record<string, number>; // counts per tag
  options: any;           // normalized listener options used for the bucket
};
```

#### `count(eventType?) → number`

Returns number of registered handlers.

If `eventType` is provided, counts only that event type.

---

## Handler semantics

### Invocation

```js
function handler(evt) {
  // `this` is the element that matched the selector
}
```

* `evt` — the native event
* `this` — the matched element

Handlers:

* are synchronous
* are never awaited

If a handler throws:

* the error is handled by the configured `callbackError` policy
* routing continues to other handlers unless `policy.stop` was applied earlier in the same dispatch

---

## Matching semantics

`policy.match` determines how the match element is computed:

* `"closest"` (default)  
  Uses `evt.target.closest(selector)` (element must be an `Element`).

* `"target"`  
  Uses `evt.target.matches(selector)` (element must be an `Element`).

If `evt.target` is not an `Element`, the event does not match any selector route.

---

## Propagation policy

* `policy.prevent: true` → calls `evt.preventDefault()`
* `policy.stop: true` → calls `evt.stopImmediatePropagation()`

Policy is applied only when declared for a handler.

---

## Listener options

Listener options are the native `addEventListener` options.

The delegator buckets native listeners by `options` (normalized):

* `options.capture`
* `options.passive`
* `options.once`

Handlers with different normalized listener options are grouped under separate native listeners.

---

## Timing & ordering

* Handlers run during native event propagation.
* No ordering guarantee is made between routes or handlers.

---

## Disposal

### `dispose() → void`

Permanently tears down the delegator by:

* detaching all native listeners
* clearing all registered routes and handlers
* marking the instance as disposed

After disposal:

*  Public methods that mutate state **will throw**.
* `dispose()` is idempotent (calling it more than once is a no-op).
* Introspection methods are not guaranteed to work.

---

## Environment requirements

Required (minimum):

* `root.addEventListener` / `root.removeEventListener`
* `Element.prototype.matches` (for `"target"` matching)
* `Element.prototype.closest` (for `"closest"` matching)

Supported:

* Browsers
* jsdom (if it supplies the above)

Not supported:

* Plain Node.js (no DOM)

---

## Error & throw behavior

Public methods may throw in these cases:

* Construction / `setRoot()`:
  * Construction throws **only** if an explicitly provided `root` is invalid.
  * `setRoot()` throws if called on a disposed instance.
* Registration (`on` / `set`) may throw on invalid arguments:
  * missing or invalid `eventType`, `selector`, or `handler`
  * selector validation failure when host validation is enabled
* Lifecycle (`start`) may throw:
  * if no root is configured
  * if native listener attachment fails
* All other operations are best-effort (no-ops on missing routes or buckets), unless the instance is disposed.

If an error occurs during attachment, the delegator must not claim to be running.

---

## Explicit non-guarantees

EventDelegator does **not** guarantee:

* handler execution order
* delivery under catastrophic DOM failure
* interception of non-bubbling events unless capture is used
* framework compatibility guarantees

---

## Forward compatibility

Future versions may:

* extend handler options
* add metadata to introspection outputs
* add optional routing controls

Existing semantics will not be weakened.

---

## Philosophy

> **Route precisely. Decide elsewhere.**

This contract exists to enforce that boundary.
