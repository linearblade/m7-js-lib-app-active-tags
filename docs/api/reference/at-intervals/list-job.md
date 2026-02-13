# Method — `listJob(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`listJob(jobLike)`](./list-job.md)

## `listJob(jobLike)`

### Signature

`listJob(jobLike) -> Object`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Plain object keyed by interval name with values `{ enabled, on }`.

### Side effects

None.

### Failure modes

Returns `{}` when job cannot be resolved or has no registered intervals.

### Example

```js
const state = AT.intervals.listJob(job);
```

### Related methods

* [`listJobs(name = true)`](./list-jobs.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
