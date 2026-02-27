# API Reference — Controllers

[README](../../README.md) -> [API Index](./INDEX.md)


Controller surfaces instantiated by `ActiveTags`:

* Discover -> [../../src/class/discover/Controller.js](../../src/class/discover/Controller.js)
* Events -> [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* Intervals -> [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* Observer -> [../../src/class/observer/Controller.js](../../src/class/observer/Controller.js)
* Runtime -> [../../src/class/runtime/Controller.js](../../src/class/runtime/Controller.js)

---

## Discover

Primary methods:

* `scan(sel?, opts?)`
* `registerJobs(list, opts?)`
* `sweep(sel?)`

---

## Events

Primary methods:

* `registerAll()` / `register(job)`
* `on(...)` / `off(...)`
* `enable(...)` / `disable(...)`
* `remove(job)`

---

## Intervals

Primary methods:

* `registerAll()` / `register(job)`
* `on(...)` / `off(...)`
* `enable(...)` / `disable(...)`
* `remove(job)`

---

## Observer

Primary methods:

* `start()`
* `stop()`
* selector configuration updates (service pass-through)

---

## Runtime

Primary methods:

* `createInternalJob(name, def?, opts?, e?)`
* `createJob({ name, def?, opts?, e?, headless? })`
* `createHeadlessJob(name, def?, opts?)`

Headless behavior (`createJob(..., headless:true)`):

* drops element binding (`e` is not used)
* forces `indexElement = false` (no override path)
* forces configure mode to `from` (`configureFrom(def)`)
* during stage execution, VM provides `AT.conf.env.document.body` as
  effective `e`/`job.e` when no bound element exists


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)
