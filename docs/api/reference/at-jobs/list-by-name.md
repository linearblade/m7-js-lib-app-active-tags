# Method — `listByName(name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`listByName(name)`](./list-by-name.md)

## `listByName(name)`

### Signature

`listByName(name) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical name bucket in `byName`. |

### Returns

All jobs currently indexed under that name.

### Side effects

None.

### Failure modes

Returns `[]` when name is empty or has no indexed ids.

### Example

```js
const cards = AT.jobs.listByName("profile-card");
```

### Related methods

* [`getByName(name)`](./get-by-name.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
