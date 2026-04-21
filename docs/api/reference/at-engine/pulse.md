# Method — `pulse({ max?, ticket?, requireJob?, ctx? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)

## `pulse({ max?, ticket?, requireJob?, ctx? } = {})`

### Signature

`pulse({ max?, ticket?, requireJob?, ctx? } = {}) -> Promise<number>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | No | Maximum tick iterations. Defaults to `1000`. |
| `ticket` | `string|Ticket` | No | Optional targeted ticket id/object for scoped execution. |
| `requireJob` | `Job|string|Element|Object` | No | Optional scheduler filter used only when `ticket` is omitted. Limits work to runnable tickets that require this job. |
| `ctx` | `Object` | No | Execution context forwarded to each tick. |

### Returns

Number of tick iterations that performed work during the drain pass.

### Side effects

* Runs `drain({ max, ticket, requireJob, ctx })`.
* Refreshes `AT.engine.wake` after the drain completes.
* Re-arms timed WAIT tickets so they can resume automatically.

### Failure modes

Stops early when `drain()` reaches an idle/blocked state.
Propagates exceptions from the underlying drain path.

### Usage note

Prefer `pulse()` over bare `drain()` when the ticket may enter `wait` state.
`pulse()` is the normal wait-aware execution entry point.

### Example

```js
const ticket = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "console" }
});

await AT.engine.pulse({ ticket });
```

### Related methods

* [`drain({ max?, ticket?, requireJob?, ctx? } = {})`](./drain.md)
* [`AT.engine.wake`](./wake.md)
* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)

---

## See also

* [Waits & Interrupts](../../../usage/WAITS_AND_INTERRUPTS.md)
* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
