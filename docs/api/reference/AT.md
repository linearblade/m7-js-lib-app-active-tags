# Reference — Top-Level `AT`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/ActiveTags.js](../../../src/ActiveTags.js)
* [../../../src/traits/engine.js](../../../src/traits/engine.js)
* [../../../src/traits/job.js](../../../src/traits/job.js)

## Constructor

### `new ActiveTags(lib, conf?)`

Creates the runtime instance, compiles top-level config, resolves dependencies/services, and wires subsystem controllers.

## Methods

### `start() -> Promise<void>`

Boot boundary. Performs initial discover scan, optional observer start, interval/event registration, and optional activation according to boot flags.

### `enqueueAll(reason?) -> number`

Enqueues autorun pipelines for all eligible registered jobs. Returns number of enqueue attempts.

### `toJob(ref) -> Job|undefined`

Resolves a job-like reference through the job registry.

## Exposed subsystem anchors

After construction, common public anchors include:

* `AT.jobs`
* `AT.discover`
* `AT.observer`
* `AT.events`
* `AT.intervals`
* `AT.engine`
* `AT.conf`

---

## See also

* [`AT.jobs`](./AT_JOBS.md)
* [`AT.engine`](./AT_ENGINE.md)
* [ActiveTags Class](../ACTIVE_TAGS.md)
* [API Index](../INDEX.md)
