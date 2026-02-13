# Method — `tick({ ctx?, ticket? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`tick({ ctx?, ticket? } = {})`](./tick.md)

## `tick({ ctx?, ticket? } = {})`

### Signature

`tick({ ctx?, ticket? } = {}) -> Promise<Object>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ctx` | `Object` | No | Execution context forwarded to VM operations. |
| `ticket` | `string|Ticket|null` | No | Optional targeted ticket id/object. When omitted, scheduler-selected execution is used. |

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

* [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)
* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
