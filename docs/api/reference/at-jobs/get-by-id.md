# Method — `getById(id)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getById(id)`](./get-by-id.md)

## `getById(id)`

### Signature

`getById(id) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Canonical job id. |

### Returns

Registered job for that id, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when id is unknown.

### Example

```js
const job = AT.jobs.getById("DEFAULT__at-1");
```

### Related methods

* [`resolve(x)`](./resolve.md)
* [`getByName(name)`](./get-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
