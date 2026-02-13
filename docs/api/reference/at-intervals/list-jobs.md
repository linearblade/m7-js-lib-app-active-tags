# Method — `listJobs(name = true)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`listJobs(name = true)`](./list-jobs.md)

## `listJobs(name = true)`

### Signature

`listJobs(name = true) -> string[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `boolean` | No | `true` returns names (when available); `false` returns job ids. |

### Returns

Array of identifiers for jobs that currently have interval entries.

### Side effects

None.

### Failure modes

Returns `[]` when interval registry is empty.

### Example

```js
const ids = AT.intervals.listJobs(false);
```

### Related methods

* [`listJob(jobLike)`](./list-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
