# Reference — `AT.intervals`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/interval/Controller.js](../../../src/class/interval/Controller.js)

## Lifecycle

### `destroy() -> void`

Stops active intervals and clears interval registry state.

## Registration

### `registerAll() -> number`

Registers interval definitions for all eligible jobs.

### `register(jobLike) -> number`

Registers interval definitions for a single job.

### `remove(jobLike) -> number`

Stops runtime intervals for a job and removes all its registered interval definitions.

## Introspection

### `listJob(jobLike) -> Object`

Returns interval state map for one job (`enabled`, `on` flags per interval entry).

### `listJobs(name = true) -> string[]`

Returns jobs that currently have interval definitions registered.

## Runtime on/off

### `on(jobLike?, intervalName?) -> number`

Starts enabled interval entries. Can target all jobs when `jobLike` is omitted.

### `off(jobLike?, intervalName?) -> number`

Stops active interval entries. Can target all jobs when `jobLike` is omitted.

## Enable/disable state

### `enable(jobLike, intervalName?) -> boolean`

Marks one/all job interval definitions as logically enabled.

### `disable(jobLike, intervalName?) -> boolean`

Marks one/all job interval definitions as logically disabled. Disabling also stops active intervals for targeted entries.

---

## See also

* [`AT.engine`](./AT_ENGINE.md)
* [`AT.jobs`](./AT_JOBS.md)
* [API Index](../INDEX.md)
