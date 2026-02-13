# Method — `start()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`start()`](./start.md)

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

* [`stop()`](./stop.md)
* [`setSelectors(selectorSpecs)`](./set-selectors.md)
* [`AT.discover.registerJobs(...)`](../at-discover/register-jobs.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
