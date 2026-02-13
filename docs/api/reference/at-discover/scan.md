# Method — `scan(sel?, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`scan(sel?, opts?)`](./scan.md)

## `scan(sel?, opts?)`

### Signature

`scan(sel?, opts?) -> Promise<Job[]>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sel` | `string|Element|Array<string|Element>|null` | No | Selector(s) or element(s) to scan. Defaults to `conf.boot.selector`. |
| `opts` | `Object` | No | Registration overrides forwarded to `registerJobs()`. |

### Returns

Array of registered jobs for discovered candidates. Can include existing jobs unless `ignoreExisting` is enabled.

### Side effects

* Calls `sweep(sel)` to collect candidates.
* Calls `registerJobs(list, opts)` and may create/configure/register new jobs.

### Failure modes

* Returns `[]` when no candidates are discovered.
* Propagates `sweep()` and `registerJobs()` exceptions.

### Example

```js
const jobs = await AT.discover.scan("[at]");
```

### Related methods

* [`registerJobs(list, opts?)`](./register-jobs.md)
* [`sweep(sel?)`](./sweep.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
