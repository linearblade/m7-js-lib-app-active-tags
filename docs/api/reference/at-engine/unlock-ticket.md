# Method — `unlockTicket(ticketId, token?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)

## `unlockTicket(ticketId, token?)`

### Signature

`unlockTicket(ticketId, token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `token` | `string` | No | Optional lock token guard. If provided and mismatch occurs, unlock fails. |

### Returns

`1` on success (or already unlocked), `0` on missing ticket or token mismatch.

### Side effects

* Clears `ticket.lock`.
* Does not execute or reschedule the ticket by itself.
* When resuming a waiting ticket, follow with `AT.engine.pulse({ ticket })` or `AT.engine.wake.refresh()`.

### Failure modes

Token mismatch returns `0` and keeps lock unchanged.

### Example

```js
AT.engine.unlockTicket(ticket.id, "manual-1");
await AT.engine.pulse({ ticket });
```

### Related methods

* [`lockTicket(ticketId, lock?)`](./lock-ticket.md)
* [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)
* [`AT.engine.wake`](./wake.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
