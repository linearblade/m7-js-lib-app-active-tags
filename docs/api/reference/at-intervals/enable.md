# Method — `enable(jobLike, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`enable(jobLike, intervalName?)`](./enable.md)

## `enable(jobLike, intervalName?)`

### Signature

`enable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to enable all for the job. |

### Returns

`true` when at least one targeted interval is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.enable(job, "refresh");
AT.intervals.on(job, "refresh");
```

### Related methods

* [`disable(jobLike, intervalName?)`](./disable.md)
* [`on(jobLike?, intervalName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
