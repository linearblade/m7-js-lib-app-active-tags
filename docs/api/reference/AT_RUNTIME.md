# Reference — `AT.runtime`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page documents the runtime helper surface exposed at `AT.runtime`.

Primary source:

* [../../../src/class/runtime/Controller.js](../../../src/class/runtime/Controller.js)

## Methods

* `createInternalJob(name, def?, opts?, e?)`
* `createJob({ name, def?, opts?, e?, headless? })`
* `createHeadlessJob(name, def?, opts?)`

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

---

## See also

* [Top-level `AT` reference](./AT.md)
* [Reference Manual index](./INDEX.md)
