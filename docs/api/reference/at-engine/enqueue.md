# Method — `enqueue(jobLike, key = "default", opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

## `enqueue(jobLike, key = "default", opts?)`

### Signature

`enqueue(jobLike, key = "default", opts?) -> Ticket`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string` | No | Pipeline key used for aliasing (`jobId + pipelineKey`). |
| `opts` | `Object` | No | Optional enqueue payload. |
| `opts.inputs` | `Object` | No | Runtime inputs for stage execution. |
| `opts.priority` | `number` | No | Scheduling priority metadata. Defaults to `0`. |
| `opts.meta` | `Object` | No | Diagnostic metadata attached to the ticket. |

### Returns

Ticket object for that alias. Existing active alias tickets are reused (dedupe behavior).

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

### Related methods

* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
