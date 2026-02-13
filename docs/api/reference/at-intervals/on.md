# Method — `on(jobLike?, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`on(jobLike?, intervalName?)`](./on.md)

## `on(jobLike?, intervalName?)`

### Signature

`on(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global activation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully activated.

### Side effects

* Registers runtime interval definitions with `intervalManager.register(...)`.
* Starts timers via `intervalManager.start(runtimeName)`.
* On each tick, enqueues pipeline work and drains engine for that ticket.
* Marks entries `on = true` and records `runtimeName`.

### Failure modes

* Returns `0` when no eligible intervals are found.
* Skips disabled, already-on, or structurally invalid interval records.

### Example

```js
AT.intervals.registerAll();
AT.intervals.on();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`enable(jobLike, intervalName?)`](./enable.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
