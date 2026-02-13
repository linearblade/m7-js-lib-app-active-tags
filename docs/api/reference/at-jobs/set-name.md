# Method — `setName(job, name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`setName(job, name)`](./set-name.md)

## `setName(job, name)`

### Signature

`setName(job, name) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Registered job instance. |
| `name` | `string|null` | Yes | New logical name. Falsy values clear name indexing. |

### Returns

No return value.

### Side effects

* Removes prior name index entry (if any).
* Calls `job.setName(name)`.
* Adds the new name index entry when name is truthy.

### Failure modes

No-op when `job` or `job.id` is missing.

### Example

```js
AT.jobs.setName(job, "profile-card");
```

### Related methods

* [`listByName(name)`](./list-by-name.md)
* [`getByName(name)`](./get-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
