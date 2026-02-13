# Method — `toJob(ref)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`toJob(ref)`](./to-job.md)

## `toJob(ref)`

### Signature

`toJob(ref) -> Job|undefined`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ref` | `any` | Yes | Job-like reference forwarded to the job registry resolver. |

### Returns

Resolved `Job` instance when found; otherwise `undefined`.

### Side effects

None. This is a pure resolver wrapper over `AT.jobs.resolve(...)`.

### Failure modes

* Returns `undefined` when resolution fails.
* Does not throw for unresolved references.

### Example

```js
const job = AT.toJob("DEFAULT__at-3");
if (!job) return;
```

### Related methods

* [`AT.jobs.resolve()`](../at-jobs/resolve.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
