# Method — `getTicketByJob(jobLike, key?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

## `getTicketByJob(jobLike, key?)`

### Signature

`getTicketByJob(jobLike, key?) -> Ticket|null|Ticket[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string|undefined` | No | Pipeline key. When omitted, returns all active tickets for job. |

### Returns

* With `key`: single `Ticket` or `null`.
* Without `key`: `Ticket[]` (possibly empty).

### Side effects

None.

### Failure modes

Unresolved job returns `null` (keyed mode) or `[]` (all-tickets mode).

### Example

```js
const one = AT.engine.getTicketByJob(job, "default");
const all = AT.engine.getTicketByJob(job);
```

### Related methods

* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)
* [`cancel(jobLike, key = "default")`](./cancel.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
