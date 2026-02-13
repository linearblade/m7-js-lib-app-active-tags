# Method — `disable(jobLike, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`disable(jobLike, intervalName?)`](./disable.md)

## `disable(jobLike, intervalName?)`

### Signature

`disable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to disable all for the job. |

### Returns

`true` when at least one targeted interval changed from enabled to disabled.

### Side effects

* Stops running intervals for targeted entries (`disable` implies runtime `off`).
* Sets logical `enabled = false` for targeted entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.disable(job, "refresh");
```

### Related methods

* [`enable(jobLike, intervalName?)`](./enable.md)
* [`off(jobLike?, intervalName?)`](./off.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
