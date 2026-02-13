# Method — `cancelTicket(ticketId)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`cancelTicket(ticketId)`](./cancel-ticket.md)

## `cancelTicket(ticketId)`

### Signature

`cancelTicket(ticketId) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |

### Returns

`1` when cancellation/cleanup succeeded, `0` when ticket record is missing.

### Side effects

* Deletes ticket from global runtime ticket index.
* Removes ticket from active slot or job queue when present.
* Cleans alias mapping defensively when it points to the target ticket.
* May mark job runnable if queued work remains and job is not locked.

### Failure modes

Returns `0` for unknown ticket id.

### Example

```js
AT.engine.cancelTicket(ticket.id);
```

### Related methods

* [`cancel(jobLike, key = "default")`](./cancel.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
