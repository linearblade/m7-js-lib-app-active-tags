# Method — `resolve(x)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`resolve(x)`](./resolve.md)

## `resolve(x)`

### Signature

`resolve(x) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `x` | `any` | Yes | Job-like reference (id/name string, element, job-like object). |

### Returns

Resolved `Job` or `null`.

### Side effects

None.

### Failure modes

* Returns `null` for unknown or unsupported references.
* Ambiguous name lookup returns `null`.

### Example

```js
const job = AT.jobs.resolve(ref);
if (!job) return;
```

### Related methods

* [`toJob(ref)`](../at/INDEX.md)
* [`getById(id)`](./get-by-id.md)
* [`getByElement(el)`](./get-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
