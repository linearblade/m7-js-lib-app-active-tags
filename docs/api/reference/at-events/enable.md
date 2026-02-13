# Method — `enable(jobLike, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`enable(jobLike, eventName?)`](./enable.md)

## `enable(jobLike, eventName?)`

### Signature

`enable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, enables all bindings for job. |

### Returns

`true` when at least one target is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

* Returns `false` when job cannot be resolved, no registry entry exists, or named event is missing.
* Does not install handlers.

### Example

```js
AT.events.enable(job, "submit");
AT.events.on(job, "submit");
```

### Related methods

* [`disable(jobLike, eventName?)`](./disable.md)
* [`on(jobLike?, eventName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
