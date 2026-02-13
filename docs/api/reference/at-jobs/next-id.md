# Method — `nextId()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`nextId()`](./next-id.md)

## `nextId()`

### Signature

`nextId() -> string`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Generates the next registry id. |

### Returns

A new id in `${prefix}-${counter}` format.

### Side effects

Increments the internal id counter.

### Failure modes

None.

### Example

```js
const id = AT.jobs.nextId();
```

### Related methods

* [`register(job)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
