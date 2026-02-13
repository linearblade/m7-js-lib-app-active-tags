# Method — `getIdByElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getIdByElement(el)`](./get-id-by-element.md)

## `getIdByElement(el)`

### Signature

`getIdByElement(el) -> string|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Job id for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no mapping exists.

### Example

```js
const id = AT.jobs.getIdByElement(el);
```

### Related methods

* [`getByElement(el)`](./get-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
