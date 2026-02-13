# Deep Reference — `AT.observer`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/observer/Controller.js](../../../../src/class/observer/Controller.js)

---

## `start()`

### Signature

`start() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Uses compiled config to derive selector specs. |

### Returns

No return value.

### Side effects

* Reads observation policy from `conf.observe` and fallback selector from `conf.boot.selector`.
* Builds selector specs and stores them in `_selectorSpecs`.
* Calls `observer.setSelectors(selectorSpecs)` and `observer.start()`.
* Wires callbacks to `_onDomChanges(batch)`.

### Failure modes

* Throws if observer service is missing.
* Throws if runtime document is missing/invalid.
* Throws when resolved selector list is empty.
* Throws when attribute observation is enabled but attribute filter list is empty.

### Example

```js
AT.observer.start();
```

### Related methods

* [`stop()`](./INDEX.md)
* [`setSelectors(selectorSpecs)`](./INDEX.md)
* [`AT.discover.registerJobs(...)`](../at-discover/INDEX.md)

---

## `stop()`

### Signature

`stop() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Stops observation on the injected observer service. |

### Returns

No return value.

### Side effects

Calls `observer.stop()` when observer exists.

### Failure modes

No-op when observer service is unavailable.

### Example

```js
AT.observer.stop();
```

### Related methods

* [`start()`](./INDEX.md)

---

## `setSelectors(selectorSpecs)`

### Signature

`setSelectors(selectorSpecs) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `selectorSpecs` | `any` | Yes | Prebuilt selector spec(s) expected by the observer service. |

### Returns

No return value.

### Side effects

* Stores provided value in `_selectorSpecs`.
* Forwards value directly to `observer.setSelectors(...)`.

### Failure modes

* No-op when observer service is missing.
* Invalid selector spec shapes may fail later in the observer service.

### Example

```js
AT.observer.setSelectors([
  {
    selector: "[at]",
    includeSubtreeMatches: true,
    observeAttributes: true,
    attributeFilter: ["at"],
    onEvent: (batch) => console.log(batch)
  }
]);
```

### Related methods

* [`start()`](./INDEX.md)
* [`stop()`](./INDEX.md)

---

## See also

* [`AT.observer` index page](../AT_OBSERVER.md)
* [`AT.discover` deep reference](../at-discover/INDEX.md)
