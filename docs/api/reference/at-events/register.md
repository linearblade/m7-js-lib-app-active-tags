# Method — `register(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`register(jobLike)`](./register.md)

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of event entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.events`.
* Stores normalized entries with runtime state fields (`enabled`, `on`, `runtimeTag`, `offFn`).
* Re-registering replaces definitions and resets `on` state in the registry entry.
* Keeps per-event `selector` definitions (optional trigger filter within the job element).

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or events config is missing/invalid.
* Skips event records missing `event` or `pipeline`.

### Example

```js
const added = AT.events.register(job);
```

### Related methods

* [`registerAll()`](./register-all.md)
* [`remove(jobLike)`](./remove.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
