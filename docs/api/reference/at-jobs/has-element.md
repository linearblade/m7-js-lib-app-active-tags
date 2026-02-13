# Method — `hasElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`hasElement(el)`](./has-element.md)

## `hasElement(el)`

### Signature

`hasElement(el) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element to test. |

### Returns

`true` when the element is already bound to a registered job.

### Side effects

None.

### Failure modes

Returns `false` when the element is not registered.

### Example

```js
if (AT.jobs.hasElement(el)) return;
```

### Related methods

* [`getIdByElement(el)`](./get-id-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
