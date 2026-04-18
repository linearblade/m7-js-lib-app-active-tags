# Method — `enqueueAll(opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`enqueueAll(opts?)`](./enqueue-all.md)

## `enqueueAll(opts?)`

### Signature

`enqueueAll(opts?) -> number | { count, entries }`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `opts` | `string\|Object` | No | Legacy string reason or options object. |
| `opts.reason` | `string` | No | Diagnostic reason attached to enqueue inputs. Defaults to `"none given"` when empty. |
| `opts.returnMeta` | `boolean` | No | When true, `enqueueAll` returns enqueue metadata entries in addition to count. |
| `opts.internal` | `boolean` | No | When true, include internal synthetic jobs in the autorun sweep. |
| `opts.rerun` | `boolean` | No | When true, include jobs whose `flags.hasRun === true`. |

### Returns

Default return is number of enqueue attempts issued across all eligible jobs and autorun pipeline keys.

When `opts.returnMeta` is true, return shape is:

```js
{
  count: number,
  entries: Array<{
    jobId: string,
    pipelineKey: string,
    ticket: Ticket|null,
    created: boolean
  }>
}
```

### Side effects

* Iterates over `AT.jobs.list()`.
* For eligible jobs (`enabled !== false` and non-empty `autorun` list), calls `AT.engine.enqueue(job, key, opts)`.
* Normalizes `"__DEFAULT__"` autorun entries to `"default"`.
* Skips internal jobs by default unless `opts.internal === true`.
* Skips jobs that have already run by default unless `opts.rerun === true`.

### Failure modes

* No-op for jobs that are disabled or have no autorun pipelines.
* Propagates exceptions from `AT.engine.enqueue(...)` if enqueue fails.

### Example

```js
// Enqueue all autorun pipelines discovered so far.
const count = AT.enqueueAll("boot");
```

```js
const out = AT.enqueueAll({
  reason: "boot",
  returnMeta: true,
  rerun: true
});
// out -> { count, entries }
```

### Related methods

* [`AT.engine.enqueue()`](../at-engine/enqueue.md)
* [`AT.jobs.list()`](../at-jobs/list.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
