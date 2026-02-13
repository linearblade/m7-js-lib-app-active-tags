# Deep Reference — `AT.intervals`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/interval/Controller.js](../../../../src/class/interval/Controller.js)

---

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down interval runtime state for this controller. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to cancel active interval timers.
* Clears internal interval registry.

### Failure modes

Safe to call repeatedly; behavior depends on interval service cancellation semantics.

### Example

```js
AT.intervals.destroy();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./INDEX.md)
* [`registerAll()`](./INDEX.md)

---

## `registerAll()`

### Signature

`registerAll() -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Scans all jobs in the registry. |

### Returns

Number of jobs for which `register(job)` was invoked.

### Side effects

Populates or refreshes per-job interval entries in the internal registry.

### Failure modes

* Returns `0` when no jobs are available.
* Skips jobs where `job.config.schema.enable.enabled` is disabled.

### Example

```js
const jobsProcessed = AT.intervals.registerAll();
```

### Related methods

* [`register(jobLike)`](./INDEX.md)
* [`on(jobLike?, intervalName?)`](./INDEX.md)

---

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of interval entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.intervals`.
* Stores normalized entries with logical/runtime fields (`enabled`, `on`, `def`).
* Re-registering replaces definitions and resets runtime-on state in registry entries.

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or intervals config is missing/invalid.
* Skips records missing positive `repeat` or non-empty `pipeline`.

### Example

```js
const added = AT.intervals.register(job);
```

### Related methods

* [`registerAll()`](./INDEX.md)
* [`remove(jobLike)`](./INDEX.md)

---

## `remove(jobLike)`

### Signature

`remove(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Number of interval entries removed for that job.

### Side effects

* Calls `off(job)` first to cancel active timers.
* Deletes the job interval map from registry.

### Failure modes

Returns `0` when job cannot be resolved or no interval map exists.

### Example

```js
AT.intervals.remove(job);
```

### Related methods

* [`off(jobLike?, intervalName?)`](./INDEX.md)
* [`register(jobLike)`](./INDEX.md)

---

## `listJob(jobLike)`

### Signature

`listJob(jobLike) -> Object`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Plain object keyed by interval name with values `{ enabled, on }`.

### Side effects

None.

### Failure modes

Returns `{}` when job cannot be resolved or has no registered intervals.

### Example

```js
const state = AT.intervals.listJob(job);
```

### Related methods

* [`listJobs(name = true)`](./INDEX.md)

---

## `listJobs(name = true)`

### Signature

`listJobs(name = true) -> string[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `boolean` | No | `true` returns names (when available); `false` returns job ids. |

### Returns

Array of identifiers for jobs that currently have interval entries.

### Side effects

None.

### Failure modes

Returns `[]` when interval registry is empty.

### Example

```js
const ids = AT.intervals.listJobs(false);
```

### Related methods

* [`listJob(jobLike)`](./INDEX.md)

---

## `on(jobLike?, intervalName?)`

### Signature

`on(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global activation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully activated.

### Side effects

* Registers runtime interval definitions with `intervalManager.register(...)`.
* Starts timers via `intervalManager.start(runtimeName)`.
* On each tick, enqueues pipeline work and drains engine for that ticket.
* Marks entries `on = true` and records `runtimeName`.

### Failure modes

* Returns `0` when no eligible intervals are found.
* Skips disabled, already-on, or structurally invalid interval records.

### Example

```js
AT.intervals.registerAll();
AT.intervals.on();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./INDEX.md)
* [`enable(jobLike, intervalName?)`](./INDEX.md)

---

## `off(jobLike?, intervalName?)`

### Signature

`off(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global deactivation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully deactivated.

### Side effects

* Cancels runtime timers via `intervalManager.cancel(runtimeName)`.
* Clears runtime state (`on`, `runtimeName`) on affected entries.

### Failure modes

Returns `0` for unresolved jobs, missing intervals, or intervals already off.

### Example

```js
AT.intervals.off(job, "refresh");
AT.intervals.off();
```

### Related methods

* [`on(jobLike?, intervalName?)`](./INDEX.md)
* [`disable(jobLike, intervalName?)`](./INDEX.md)

---

## `enable(jobLike, intervalName?)`

### Signature

`enable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to enable all for the job. |

### Returns

`true` when at least one targeted interval is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.enable(job, "refresh");
AT.intervals.on(job, "refresh");
```

### Related methods

* [`disable(jobLike, intervalName?)`](./INDEX.md)
* [`on(jobLike?, intervalName?)`](./INDEX.md)

---

## `disable(jobLike, intervalName?)`

### Signature

`disable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to disable all for the job. |

### Returns

`true` when at least one targeted interval changed from enabled to disabled.

### Side effects

* Stops running intervals for targeted entries (`disable` implies runtime `off`).
* Sets logical `enabled = false` for targeted entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.disable(job, "refresh");
```

### Related methods

* [`enable(jobLike, intervalName?)`](./INDEX.md)
* [`off(jobLike?, intervalName?)`](./INDEX.md)

---

## See also

* [`AT.intervals` index page](../AT_INTERVALS.md)
* [`AT.engine` deep reference](../at-engine/INDEX.md)
* [`AT.jobs` deep reference](../at-jobs/INDEX.md)
