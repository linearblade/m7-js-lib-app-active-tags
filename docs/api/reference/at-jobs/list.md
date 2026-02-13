# Method — `list()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`list()`](./list.md)

## `list()`

### Signature

`list() -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Returns all registered jobs. |

### Returns

Snapshot array of all jobs (Map insertion order).

### Side effects

None.

### Failure modes

Returns an empty array when registry is empty.

### Example

```js
for (const job of AT.jobs.list()) {
  // inspect each registered job
}
```

### Related methods

* [`listByStatus(status)`](./list-by-status.md)
* [`listByName(name)`](./list-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
