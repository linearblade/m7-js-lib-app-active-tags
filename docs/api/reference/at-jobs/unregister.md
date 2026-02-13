# Method — `unregister(jobOrIdOrEl, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)

## `unregister(jobOrIdOrEl, opts?)`

### Signature

`unregister(jobOrIdOrEl, opts?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobOrIdOrEl` | `Job|string|number|Element|Object` | Yes | Target job reference to remove. |
| `opts` | `Object` | No | Optional options. |
| `opts.reason` | `string` | No | Reason passed into `job.shutdown()` and shutdown log metadata. |

### Returns

`true` when a job was resolved and removed; otherwise `false`.

### Side effects

* Calls `job.shutdown({ reason })` before index removal.
* Records shutdown metadata.
* Removes all id/element/name/createdAt indexes for the job.

### Failure modes

* No-op with `false` when the target cannot be resolved.
* Propagates exceptions thrown by `job.shutdown(...)`.

### Example

```js
AT.jobs.unregister(el, { reason: "dom removed" });
```

### Related methods

* [`register(job)`](./register.md)
* [`resolve(x)`](./resolve.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
