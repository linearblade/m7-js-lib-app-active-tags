# Method — `remove(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`remove(jobLike)`](./remove.md)

## `remove(jobLike)`

### Signature

`remove(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Number of interval entries removed for that job.

### Side effects

* Calls `off(job)` first to cancel active timers.
* Deletes the job interval map from registry.

### Failure modes

Returns `0` when job cannot be resolved or no interval map exists.

### Example

```js
AT.intervals.remove(job);
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`register(jobLike)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
