# Method — `getByElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getByElement(el)`](./get-by-element.md)

## `getByElement(el)`

### Signature

`getByElement(el) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Registered job for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no element mapping exists.

### Example

```js
const job = AT.jobs.getByElement(el);
```

### Related methods

* [`getIdByElement(el)`](./get-id-by-element.md)
* [`hasElement(el)`](./has-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
