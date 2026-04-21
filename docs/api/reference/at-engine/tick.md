# Method — `tick({ ctx?, ticket?, requireJob? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`tick({ ctx?, ticket?, requireJob? } = {})`](./tick.md)

## `tick({ ctx?, ticket?, requireJob? } = {})`

### Signature

`tick({ ctx?, ticket?, requireJob? } = {}) -> Promise<Object>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ctx` | `Object` | No | Execution context forwarded to VM operations. |
| `ticket` | `string|Ticket|null` | No | Optional targeted ticket id/object. When omitted, scheduler-selected execution is used. |
| `requireJob` | `Job|string|Element|Object` | No | Optional scheduler filter used only when `ticket` is omitted. Limits next-runnable selection to tickets whose `ticket.require` includes this dependency. |

### Returns

Normalized tick trace object (wrapped in a promise) describing one execution step.

### Side effects

* May promote queued ticket to active.
* Executes one VM stage.
* Updates ticket/job runtime state.
* Emits engine hooks (`onStage`, `onComplete`, `onError`, etc.) as applicable.

### Failure modes

* Does not throw VM step errors outward; they are normalized into error traces.
* Returns trace with `didWork: false` when nothing runnable, missing ticket, locked state, etc.

### Example

```js
const trace = await AT.engine.tick();
if (!trace.didWork) {
  // engine is idle or blocked
}
```

### Related methods

* [`drain({ max?, ticket?, requireJob?, ctx? } = {})`](./drain.md)
* [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)
* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
