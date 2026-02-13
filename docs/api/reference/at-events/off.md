# Method — `off(jobLike?, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`off(jobLike?, eventName?)`](./off.md)

## `off(jobLike?, eventName?)`

### Signature

`off(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully uninstalled.

### Side effects

* Runs stored unsubscriber `offFn()` when present.
* Calls defensive `delegator.offTag(runtimeTag)` cleanup when runtime tag exists.
* Clears runtime state (`on`, `runtimeTag`, `offFn`) for each affected binding.

### Failure modes

Returns `0` for unresolved jobs, missing bindings, or bindings that are already off.

### Example

```js
AT.events.off(job, "submit");
AT.events.off(); // global teardown
```

### Related methods

* [`on(jobLike?, eventName?)`](./on.md)
* [`destroy()`](./destroy.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
