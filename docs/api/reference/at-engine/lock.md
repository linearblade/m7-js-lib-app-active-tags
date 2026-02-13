# Method — `lock(jobLike, key = "default", lock?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`lock(jobLike, key = "default", lock?)`](./lock.md)

## `lock(jobLike, key = "default", lock?)`

### Signature

`lock(jobLike, key = "default", lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `lock` | `Object` | No | Optional lock object. Default `jobKey` lock is generated when omitted. |

### Returns

`1` when active alias ticket was found and locked; otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `lockTicket(...)`.

### Failure modes

Returns `0` when no active ticket exists for `(job, key)`.

### Example

```js
AT.engine.lock(job, "default");
```

### Related methods

* [`unlock(jobLike, key = "default", token?)`](./unlock.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
