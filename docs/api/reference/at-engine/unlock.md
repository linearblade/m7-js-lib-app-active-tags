# Method — `unlock(jobLike, key = "default", token?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`unlock(jobLike, key = "default", token?)`](./unlock.md)

## `unlock(jobLike, key = "default", token?)`

### Signature

`unlock(jobLike, key = "default", token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `token` | `string` | No | Optional token passed through to `unlockTicket(...)`. |

### Returns

`1` when alias ticket unlock succeeds (or was already unlocked), otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `unlockTicket(...)`.
Unlocking does not execute the resumed ticket by itself.

### Failure modes

Returns `0` when no active alias ticket exists or token check fails.

### Example

```js
AT.engine.unlock(job, "default");
AT.engine.wake.refresh();
```

### Related methods

* [`lock(jobLike, key = "default", lock?)`](./lock.md)
* [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)
* [`AT.engine.wake`](./wake.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
