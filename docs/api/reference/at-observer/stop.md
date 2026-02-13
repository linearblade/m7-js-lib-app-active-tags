# Method — `stop()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`stop()`](./stop.md)

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

* [`start()`](./start.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
