# Reference — `AT.discover`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/discover/Controller.js](../../../src/class/discover/Controller.js)

## Methods

### `scan(sel?, opts?) -> Promise<Job[]>`

Primary discover entry point. Sweeps DOM candidates and registers jobs for matched elements.

### `registerJobs(list, opts?) -> Promise<Job[]>`

Instantiates/configures/registers jobs for a provided element list.

### `sweep(sel?) -> Element[]`

Pure DOM discovery (no registration side effects). Returns de-duplicated matched elements.

## Notes

* `scan()` and `registerJobs()` can perform registration side effects.
* `sweep()` is the side-effect-free selector/element collector.

---

## See also

* [`AT.jobs`](./AT_JOBS.md)
* [`AT.observer`](./AT_OBSERVER.md)
* [API Index](../INDEX.md)
