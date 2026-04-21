# Method — `autorun(opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`autorun(opts?)`](./autorun.md)

## `autorun(opts?)`

### Signature

`autorun(opts?) -> Promise<number | { count, entries }>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `opts` | `string\|Object` | No | Options forwarded to `AT.enqueueAll(opts)`. |

### Returns

Resolves with the return value from `AT.enqueueAll(opts)` after `AT.engine.pulse()`
completes.

### Side effects

* Calls `AT.enqueueAll(opts)`.
* Calls `AT.engine.pulse()`.
* Uses the same autorun eligibility rules as `enqueueAll()`.

### Failure modes

* Propagates exceptions from `AT.enqueueAll(...)`.
* Propagates exceptions from `AT.engine.pulse(...)`.

### Example

```js
await AT.autorun("startup");
```

### Related methods

* [`enqueueAll(opts?)`](./enqueue-all.md)
* [`AT.engine.pulse()`](../at-engine/pulse.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
