# Method — `on(jobLike?, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`on(jobLike?, eventName?)`](./on.md)

## `on(jobLike?, eventName?)`

### Signature

`on(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally across registry jobs. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully installed.

### Side effects

* Installs handlers via `delegator.on(...)` for enabled, currently-off bindings.
* Records runtime state (`on`, `runtimeTag`, `offFn`) per binding.
* Selector behavior is per-event and optional:
  * no selector -> trigger at job element context
  * selector set -> trigger only for matching descendants inside the job element

### Failure modes

* Returns `0` when no eligible bindings are found.
* Skips disabled bindings and already-installed bindings.
* Skips bindings with invalid event/pipeline definitions.

### Example

```js
AT.events.registerAll();
AT.events.on(); // global activation
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
