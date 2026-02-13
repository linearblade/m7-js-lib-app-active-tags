# Method — `disable(jobLike, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`disable(jobLike, eventName?)`](./disable.md)

## `disable(jobLike, eventName?)`

### Signature

`disable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, disables all bindings for job. |

### Returns

`true` when at least one targeted binding changed from enabled to disabled.

### Side effects

* Uninstalls active handlers for targeted bindings (`disable` implies `off`).
* Mutates logical `enabled` flags.

### Failure modes

Returns `false` when job cannot be resolved, no event entry exists, or named event is missing.

### Example

```js
AT.events.disable(job, "submit");
```

### Related methods

* [`enable(jobLike, eventName?)`](./enable.md)
* [`off(jobLike?, eventName?)`](./off.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
