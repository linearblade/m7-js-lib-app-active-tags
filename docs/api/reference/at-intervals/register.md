# Method — `register(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`register(jobLike)`](./register.md)

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of interval entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.intervals`.
* Stores normalized entries with logical/runtime fields (`enabled`, `on`, `def`).
* Re-registering replaces definitions and resets runtime-on state in registry entries.

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or intervals config is missing/invalid.
* Skips records missing positive `repeat` or non-empty `pipeline`.

### Example

```js
const added = AT.intervals.register(job);
```

### Related methods

* [`registerAll()`](./register-all.md)
* [`remove(jobLike)`](./remove.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
