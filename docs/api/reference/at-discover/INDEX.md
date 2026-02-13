# Deep Reference — `AT.discover`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/discover/Controller.js](../../../../src/class/discover/Controller.js)

---

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

* [`registerJobs(list, opts?)`](./INDEX.md)
* [`sweep(sel?)`](./INDEX.md)

---

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

* [`scan(sel?, opts?)`](./INDEX.md)
* [`AT.jobs.register(job)`](../at-jobs/INDEX.md)

---

## `sweep(sel?)`

### Signature

`sweep(sel?) -> Element[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sel` | `string|Element|Array<string|Element>|null` | No | Selector(s) or element(s). Defaults to `conf.boot.selector`. |

### Returns

De-duplicated array of matching DOM elements.

### Side effects

None. `sweep()` is discovery-only and does not register jobs.

### Failure modes

* Throws if `conf.env` is missing.
* Throws if `conf.env.document` is missing or invalid.

### Example

```js
const nodes = AT.discover.sweep(["[at]", "[data-at]"]);
```

### Related methods

* [`scan(sel?, opts?)`](./INDEX.md)
* [`AT.observer.start()`](../at-observer/INDEX.md)

---

## See also

* [`AT.discover` index page](../AT_DISCOVER.md)
* [`AT.jobs` deep reference](../at-jobs/INDEX.md)
