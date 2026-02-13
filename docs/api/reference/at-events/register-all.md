# Method — `registerAll()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`registerAll()`](./register-all.md)

## `registerAll()`

### Signature

`registerAll() -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Scans all jobs in the registry. |

### Returns

Number of jobs for which `register(job)` was invoked.

### Side effects

Populates or refreshes event entries in the internal controller registry.

### Failure modes

* Returns `0` when no jobs are available.
* Skips jobs where `job.config.schema.enable.enabled` is disabled.

### Example

```js
const jobsProcessed = AT.events.registerAll();
```

### Related methods

* [`register(jobLike)`](./register.md)
* [`on(jobLike?, eventName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
