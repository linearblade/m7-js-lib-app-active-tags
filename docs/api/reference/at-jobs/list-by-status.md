# Method — `listByStatus(status)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`listByStatus(status)`](./list-by-status.md)

## `listByStatus(status)`

### Signature

`listByStatus(status) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | Yes | Exact `job.status` value to match (`===`). |

### Returns

Array of jobs whose status exactly matches.

### Side effects

None.

### Failure modes

Returns `[]` when no jobs match.

### Example

```js
const running = AT.jobs.listByStatus("running");
```

### Related methods

* [`list()`](./list.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
