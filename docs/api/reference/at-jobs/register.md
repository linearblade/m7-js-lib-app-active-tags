# Method — `register(job)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`register(job)`](./register.md)

## `register(job)`

### Signature

`register(job) -> Job`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Job instance with a DOM element (`job.e`). |

### Returns

Registered job. If the element is already registered, returns the existing job.

### Side effects

* Assigns identity with `job.setIdentity({ id, createdAt })`.
* Updates `byId`, `byEl`, `createdAt`, and optional `byName` indexes.

### Failure modes

* Throws if `job` or `job.e` is missing.
* Throws on id collision with another registered job.

### Example

```js
const registered = AT.jobs.register(job);
```

### Related methods

* [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
