# Reference — `AT.runtime`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page documents the runtime helper surface exposed at `AT.runtime`.

Primary source:

* [../../../src/class/runtime/Controller.js](../../../src/class/runtime/Controller.js)

## Methods

* `createInternalJob(name, def?, opts?, e?)`
* `createJob({ name, def?, opts?, e?, headless? })`
* `createHeadlessJob(name, def?, opts?)`
* `attachObservedNodes(nodes, opts?)`
* `disposeJob(jobLike, opts?)`
* `disposeJobs(list, opts?)`

## Internal-job behavior

`createInternalJob(...)`:

* requires a non-empty `name` (after internal normalization)
* derives `identifier` from normalized `name`
* wraps `createJob(...)` with:
  * `indexElement: false`
  * `returnExisting: true`
  * `enforceNameUnique: true`
  * `configure: "from"`

## Headless behavior

For `createJob({...})`, when `headless:true`:

* `e` is dropped
* `indexElement` is forced to `false` (no override path)
* configure mode is forced to `from` (`configureFrom(def)`)
* VM stage execution uses `AT.conf.env.document.body` as effective `e`/`job.e`
  when no bound element exists

## Name uniqueness

For `createJob({...})`, `opts.enforceNameUnique` defaults to `true`.

When enabled and a non-empty name is provided:

* one existing name match -> existing job is reused
* multiple matches -> throws ambiguity error
* no matches -> new job is created

## Observer-runtime helpers

These helpers are primarily used by `AT.observer`, but they are exposed on `AT.runtime` as part of the runtime controller surface.

`attachObservedNodes(nodes, opts?)`:

* filters to newly discovered matching elements
* registers new jobs through discover
* when `conf.observe.runtimeAttach` is enabled, registers event/interval runtime state for new jobs
* conditionally enables events/intervals using the normal `conf.boot.events` / `conf.boot.intervals` gates
* runs `AT.autorun(reason)`

When `conf.observe.runtimeAttach` is disabled, this helper falls back to discovery plus autorun only.

`disposeJob(jobLike, opts?)` and `disposeJobs(list, opts?)`:

* resolve jobs through the normal `AT.toJob(...)` path
* when `conf.observe.runtimeDispose` is enabled, remove event and interval runtime state before unregister
* otherwise fall back to unregister-only behavior

These helpers are intended for observer-driven lifecycle work, not as a replacement for normal boot/startup.

---

## See also

* [Top-level `AT` reference](./AT.md)
* [Reference Manual index](./INDEX.md)
