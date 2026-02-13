# Method — `registerJobs(list, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`registerJobs(list, opts?)`](./register-jobs.md)

## `registerJobs(list, opts?)`

### Signature

`registerJobs(list, opts?) -> Promise<Job[]>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `list` | `Array<Element>|ArrayLike<Element>` | Yes | Candidate elements to register as jobs. |
| `opts` | `Object` | No | Overrides. Supported keys: `ignoreExisting`, `evalEnabled`, `evalType`, `importEnabled`, `importPath`. |

### Returns

Array of jobs corresponding to processed elements.

### Side effects

* Creates `Job` instances for new elements.
* Registers jobs via `AT.jobs.register(...)`.
* Merges job config overrides and calls `job.configure(jobConf)`.
* Emits configuration diagnostics via `configReporter(...)`.
* Updates job name index via `AT.jobs.setName(...)`.

### Failure modes

* Skips non-DOM values silently.
* May throw from `Job` construction, registry registration, or `job.configure(...)`.

### Example

```js
const jobs = await AT.discover.registerJobs(nodeList, {
  importEnabled: true,
  importPath: "/pipelines"
});
```

### Related methods

* [`scan(sel?, opts?)`](./scan.md)
* [`AT.jobs.register(job)`](../at-jobs/register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
