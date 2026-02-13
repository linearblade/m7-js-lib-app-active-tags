# Reference — `AT.events`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/event/Controller.js](../../../src/class/event/Controller.js)

## Lifecycle

### `destroy() -> void`

Uninstalls active delegated handlers and clears event registry state.

## Registration

### `registerAll() -> number`

Registers event definitions for all eligible jobs.

### `register(jobLike) -> number`

Registers event definitions for a single job.

### `remove(jobLike) -> number`

Uninstalls handlers for a job and removes all its registered event definitions.

## Introspection

### `listJob(jobLike) -> Object`

Returns event state map for one job (`enabled`, `on` flags per event entry).

### `listJobs(name = true) -> string[]`

Returns jobs that currently have event definitions registered.

## Enable/disable state

### `enable(jobLike, eventName?) -> boolean`

Marks one/all job event definitions as logically enabled.

### `disable(jobLike, eventName?) -> boolean`

Marks one/all job event definitions as logically disabled. Disabling also uninstalls active handlers for targeted entries.

## Runtime on/off

### `on(jobLike?, eventName?) -> number`

Installs delegated handlers for enabled event entries. Can target all jobs when `jobLike` is omitted.

### `off(jobLike?, eventName?) -> number`

Uninstalls delegated handlers. Can target all jobs when `jobLike` is omitted.

---

## See also

* [`AT.engine`](./AT_ENGINE.md)
* [`AT.jobs`](./AT_JOBS.md)
* [API Index](../INDEX.md)
