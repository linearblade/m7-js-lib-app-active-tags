# Method — `drain({ max?, ticket?, ctx? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)

## `drain({ max?, ticket?, ctx? } = {})`

### Signature

`drain({ max?, ticket?, ctx? } = {}) -> Promise<number>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | No | Maximum tick iterations. Defaults to `1000`. |
| `ticket` | `string|Ticket` | No | Optional targeted ticket id/object for scoped draining. |
| `ctx` | `Object` | No | Execution context forwarded to each tick. |

### Returns

Number of tick iterations that performed work.

### Side effects

Repeatedly invokes `tick(...)` until no work remains or `max` is reached.

### Failure modes

Stops early when `tick()` reports no work (`didWork: false`).

### Example

```js
await AT.engine.drain({ max: 200 });
```

### Related methods

* [`tick({ ctx?, ticket? } = {})`](./tick.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
