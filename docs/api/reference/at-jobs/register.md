# Method — `register(job)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`register(job)`](./register.md)

## `register(job)`

### Signature

`register(job, opts?) -> Job`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Job instance to register. |
| `opts` | `Object` | No | Registration options. |
| `opts.indexElement` | `boolean` | No | When `true` (default), index by `job.e` and require an element. |
| `opts.returnExisting` | `boolean` | No | When `true`, may return existing job by id/name before new registration. |

### Returns

Registered job. May return an existing job when reuse rules match.

### Side effects

* Assigns identity with `job.setIdentity({ id, createdAt })`.
* Updates `byId`, `byEl`, `createdAt`, and optional `byName` indexes.

### Failure modes

* Throws if `job` is missing.
* Throws if `opts.indexElement` is `true` and `job.e` is missing.
* Throws on id collision with another registered job.

### Example

```js
const registered = AT.jobs.register(job, { indexElement: false, returnExisting: true });
```

### Related methods

* [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
