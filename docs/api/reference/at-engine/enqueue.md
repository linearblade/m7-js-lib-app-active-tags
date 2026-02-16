# Method — `enqueue(jobLike, key = "default", opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

## `enqueue(jobLike, key = "default", opts?)`

### Signature

`enqueue(jobLike, key = "default", opts?) -> Ticket | { ticket, created }`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string` | No | Pipeline key used for aliasing (`jobId + pipelineKey`). |
| `opts` | `Object` | No | Optional enqueue payload. |
| `opts.inputs` | `Object` | No | Runtime inputs for stage execution. |
| `opts.priority` | `number` | No | Scheduling priority metadata. Defaults to `0`. |
| `opts.meta` | `Object` | No | Diagnostic metadata attached to the ticket. |
| `opts.returnMeta` | `boolean` | No | When true, returns `{ ticket, created }` instead of plain ticket. |

### Returns

Default return is the ticket object for that alias.
Existing active alias tickets are reused (dedupe behavior).
When `opts.returnMeta` is true, return shape is:

```js
{ ticket: Ticket, created: boolean }
```

`created` is true only when a new ticket was created.

### Side effects

* Creates/updates runtime alias and ticket indexes.
* Pushes new ticket into per-job queue when new.
* May mark job runnable in scheduler.
* May fire `onEnqueue` hook.

### Failure modes

Throws if job cannot be resolved to a registered job with id.

### Example

```js
const ticket = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "api" }
});
```

```js
const result = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "api" },
  returnMeta: true
});
// result -> { ticket, created }
```

### Related methods

* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)
* [`drain({ max?, ticket?, requireJob?, ctx? } = {})`](./drain.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
