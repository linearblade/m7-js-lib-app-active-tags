# Method — `cancel(jobLike, key = "default")`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`cancel(jobLike, key = "default")`](./cancel.md)

## `cancel(jobLike, key = "default")`

### Signature

`cancel(jobLike, key = "default") -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |

### Returns

`1` when the alias ticket is found and cancelled, otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `cancelTicket(...)`.

### Failure modes

Returns `0` when no active alias ticket exists.

### Example

```js
AT.engine.cancel(job, "default");
```

### Related methods

* [`cancelTicket(ticketId)`](./cancel-ticket.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
