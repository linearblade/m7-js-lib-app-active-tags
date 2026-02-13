# Method — `off(jobLike?, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`off(jobLike?, intervalName?)`](./off.md)

## `off(jobLike?, intervalName?)`

### Signature

`off(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global deactivation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully deactivated.

### Side effects

* Cancels runtime timers via `intervalManager.cancel(runtimeName)`.
* Clears runtime state (`on`, `runtimeName`) on affected entries.

### Failure modes

Returns `0` for unresolved jobs, missing intervals, or intervals already off.

### Example

```js
AT.intervals.off(job, "refresh");
AT.intervals.off();
```

### Related methods

* [`on(jobLike?, intervalName?)`](./on.md)
* [`disable(jobLike, intervalName?)`](./disable.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
