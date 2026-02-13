# Method — `destroy()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`destroy()`](./destroy.md)

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down interval runtime state for this controller. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to cancel active interval timers.
* Clears internal interval registry.

### Failure modes

Safe to call repeatedly; behavior depends on interval service cancellation semantics.

### Example

```js
AT.intervals.destroy();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
