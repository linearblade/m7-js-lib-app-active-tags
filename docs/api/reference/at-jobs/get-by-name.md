# Method — `getByName(name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getByName(name)`](./get-by-name.md)

## `getByName(name)`

### Signature

`getByName(name) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical job name. |

### Returns

A single resolved job only when name resolution is unambiguous; otherwise `null`.

### Side effects

May emit a warning for ambiguous names.

### Failure modes

* Returns `null` when no matches exist.
* Returns `null` when multiple jobs share the same name.

### Example

```js
const job = AT.jobs.getByName("profile-card");
```

### Related methods

* [`listByName(name)`](./list-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
