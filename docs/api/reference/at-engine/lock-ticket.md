# Method — `lockTicket(ticketId, lock?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`lockTicket(ticketId, lock?)`](./lock-ticket.md)

## `lockTicket(ticketId, lock?)`

### Signature

`lockTicket(ticketId, lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `lock` | `Object` | No | Optional lock object. Default lock is generated when omitted. |

### Returns

`1` when ticket lock was set, otherwise `0`.

### Side effects

Mutates `ticket.lock` on the targeted ticket.

### Failure modes

Returns `0` when ticket record is missing.

### Example

```js
AT.engine.lockTicket(ticket.id, { type: "ticket", token: "manual-1" });
```

### Related methods

* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./lock.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
