# Method — `listJobs(name = true)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`listJobs(name = true)`](./list-jobs.md)

## `listJobs(name = true)`

### Signature

`listJobs(name = true) -> string[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `boolean` | No | `true` returns best-effort job names; `false` returns job ids. |

### Returns

Array of identifiers for jobs currently present in the event registry.

### Side effects

None.

### Failure modes

Returns `[]` when no job entries are registered.

### Example

```js
const ids = AT.events.listJobs(false);
const labels = AT.events.listJobs(true);
```

### Related methods

* [`listJob(jobLike)`](./list-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
