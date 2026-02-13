# Deep Reference — `AT.events`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/event/Controller.js](../../../../src/class/event/Controller.js)

---

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down this controller's runtime registrations. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to uninstall active delegated handlers.
* Clears internal registry (`jobId -> event map`).

### Failure modes

Depends on delegator teardown behavior; otherwise safe to call repeatedly.

### Example

```js
AT.events.destroy();
```

### Related methods

* [`off(jobLike?, eventName?)`](./INDEX.md)
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

Populates or refreshes event entries in the internal controller registry.

### Failure modes

* Returns `0` when no jobs are available.
* Skips jobs where `job.config.schema.enable.enabled` is disabled.

### Example

```js
const jobsProcessed = AT.events.registerAll();
```

### Related methods

* [`register(jobLike)`](./INDEX.md)
* [`on(jobLike?, eventName?)`](./INDEX.md)

---

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of event entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.events`.
* Stores normalized entries with runtime state fields (`enabled`, `on`, `runtimeTag`, `offFn`).
* Re-registering replaces definitions and resets `on` state in the registry entry.

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or events config is missing/invalid.
* Skips event records missing `event` or `pipeline`.

### Example

```js
const added = AT.events.register(job);
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

Number of event entries removed for that job.

### Side effects

* Calls `off(job)` to uninstall active handlers.
* Deletes job event map from registry.

### Failure modes

Returns `0` when the job cannot be resolved or no event map exists.

### Example

```js
AT.events.remove(job);
```

### Related methods

* [`off(jobLike?, eventName?)`](./INDEX.md)
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

Plain object keyed by event binding name with values `{ enabled, on }`.

### Side effects

None.

### Failure modes

Returns `{}` when the job cannot be resolved or has no registered events.

### Example

```js
const state = AT.events.listJob(job);
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
| `name` | `boolean` | No | `true` returns best-effort job names; `false` returns job ids. |

### Returns

Array of identifiers for jobs currently present in the event registry.

### Side effects

None.

### Failure modes

Returns `[]` when no job entries are registered.

### Example

```js
const ids = AT.events.listJobs(false);
const labels = AT.events.listJobs(true);
```

### Related methods

* [`listJob(jobLike)`](./INDEX.md)

---

## `enable(jobLike, eventName?)`

### Signature

`enable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, enables all bindings for job. |

### Returns

`true` when at least one target is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

* Returns `false` when job cannot be resolved, no registry entry exists, or named event is missing.
* Does not install handlers.

### Example

```js
AT.events.enable(job, "submit");
AT.events.on(job, "submit");
```

### Related methods

* [`disable(jobLike, eventName?)`](./INDEX.md)
* [`on(jobLike?, eventName?)`](./INDEX.md)

---

## `disable(jobLike, eventName?)`

### Signature

`disable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, disables all bindings for job. |

### Returns

`true` when at least one targeted binding changed from enabled to disabled.

### Side effects

* Uninstalls active handlers for targeted bindings (`disable` implies `off`).
* Mutates logical `enabled` flags.

### Failure modes

Returns `false` when job cannot be resolved, no event entry exists, or named event is missing.

### Example

```js
AT.events.disable(job, "submit");
```

### Related methods

* [`enable(jobLike, eventName?)`](./INDEX.md)
* [`off(jobLike?, eventName?)`](./INDEX.md)

---

## `on(jobLike?, eventName?)`

### Signature

`on(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally across registry jobs. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully installed.

### Side effects

* Installs handlers via `delegator.on(...)` for enabled, currently-off bindings.
* Records runtime state (`on`, `runtimeTag`, `offFn`) per binding.

### Failure modes

* Returns `0` when no eligible bindings are found.
* Skips disabled bindings and already-installed bindings.
* Skips bindings with invalid event/pipeline definitions.

### Example

```js
AT.events.registerAll();
AT.events.on(); // global activation
```

### Related methods

* [`off(jobLike?, eventName?)`](./INDEX.md)
* [`registerAll()`](./INDEX.md)

---

## `off(jobLike?, eventName?)`

### Signature

`off(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully uninstalled.

### Side effects

* Runs stored unsubscriber `offFn()` when present.
* Calls defensive `delegator.offTag(runtimeTag)` cleanup when runtime tag exists.
* Clears runtime state (`on`, `runtimeTag`, `offFn`) for each affected binding.

### Failure modes

Returns `0` for unresolved jobs, missing bindings, or bindings that are already off.

### Example

```js
AT.events.off(job, "submit");
AT.events.off(); // global teardown
```

### Related methods

* [`on(jobLike?, eventName?)`](./INDEX.md)
* [`destroy()`](./INDEX.md)

---

## See also

* [`AT.events` index page](../AT_EVENTS.md)
* [`AT.engine` deep reference](../at-engine/INDEX.md)
* [`AT.jobs` deep reference](../at-jobs/INDEX.md)
