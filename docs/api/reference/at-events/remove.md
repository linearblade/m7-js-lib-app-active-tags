# Method — `remove(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`remove(jobLike)`](./remove.md)

## `remove(jobLike)`

### Signature

`remove(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Number of event entries removed for that job.

### Side effects

* Calls `off(job)` to uninstall active handlers.
* Deletes job event map from registry.

### Failure modes

Returns `0` when the job cannot be resolved or no event map exists.

### Example

```js
AT.events.remove(job);
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`register(jobLike)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
