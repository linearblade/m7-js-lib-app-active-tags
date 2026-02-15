# Method — `drain({ max?, ticket?, requireJob?, ctx? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`drain({ max?, ticket?, requireJob?, ctx? } = {})`](./drain.md)

## `drain({ max?, ticket?, requireJob?, ctx? } = {})`

### Signature

`drain({ max?, ticket?, requireJob?, ctx? } = {}) -> Promise<number>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | No | Maximum tick iterations. Defaults to `1000`. |
| `ticket` | `string|Ticket` | No | Optional targeted ticket id/object for scoped draining. |
| `requireJob` | `Job|string|Element|Object` | No | Optional scheduler filter used only when `ticket` is omitted. Limits drain progression to runnable tickets that require this job. |
| `ctx` | `Object` | No | Execution context forwarded to each tick. |

### Returns

Number of tick iterations that performed work.

### Side effects

Repeatedly invokes `tick(...)` until no work remains or `max` is reached.
When `ticket` is provided, targeted mode is used and `requireJob` is ignored.

### Failure modes

Stops early when `tick()` reports no work (`didWork: false`).

### Example

```js
await AT.engine.drain({ max: 200 });
```

```js
await AT.engine.drain({
  requireJob: "header",
  max: 25
});
```

### Related methods

* [`tick({ ctx?, ticket?, requireJob? } = {})`](./tick.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
