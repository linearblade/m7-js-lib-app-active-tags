# Method — `destroy()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`destroy()`](./destroy.md)

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down this controller's runtime registrations. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to uninstall active delegated handlers.
* Clears internal registry (`jobId -> event map`).

### Failure modes

Depends on delegator teardown behavior; otherwise safe to call repeatedly.

### Example

```js
AT.events.destroy();
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
