# Method — `enqueueAll(reason?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`enqueueAll(reason?)`](./enqueue-all.md)

## `enqueueAll(reason?)`

### Signature

`enqueueAll(reason?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | Diagnostic reason attached to enqueue inputs. Defaults to `"none given"` when empty. |

### Returns

Number of enqueue attempts issued across all eligible jobs and autorun pipeline keys.

### Side effects

* Iterates over `AT.jobs.list()`.
* For eligible jobs (`enabled !== false` and non-empty `autorun` list), calls `AT.engine.enqueue(job, key, opts)`.
* Normalizes `"__DEFAULT__"` autorun entries to `"default"`.
* Writes enqueue return values to console (`console.log`).

### Failure modes

* No-op for jobs that are disabled or have no autorun pipelines.
* Propagates exceptions from `AT.engine.enqueue(...)` if enqueue fails.

### Example

```js
// Enqueue all autorun pipelines discovered so far.
const count = AT.enqueueAll("boot");
```

### Related methods

* [`AT.engine.enqueue()`](../at-engine/INDEX.md)
* [`AT.jobs.list()`](../at-jobs/INDEX.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
