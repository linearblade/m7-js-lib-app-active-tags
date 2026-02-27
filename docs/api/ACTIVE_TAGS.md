# API Reference — ActiveTags Class

[README](../../README.md) -> [API Index](./INDEX.md)


Primary runtime class:

* [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## Constructor

`new ActiveTags(lib, conf = {})`

High-level behavior:

* compile top-level runtime config
* resolve required services/dependencies
* instantiate registry, engine, controllers, runtime helper

---

## Public lifecycle

### `start()`

Initial runtime activation:

* initial discover scan
* optional observer start
* register events/intervals
* enable events/intervals per boot gates

---

## Mixed-in helper surfaces

### Job helper trait

* `toJob(ref)`

Source: [../../src/traits/job.js](../../src/traits/job.js)

### Engine helper trait

* `enqueueAll(opts)`

Source: [../../src/traits/engine.js](../../src/traits/engine.js)

### Runtime controller surface

* `AT.runtime.createInternalJob(...)`
* `AT.runtime.createJob(...)`
* `AT.runtime.createHeadlessJob(...)`

Source: [../../src/class/runtime/Controller.js](../../src/class/runtime/Controller.js)

Headless rule on `AT.runtime.createJob({...})`:

* `headless:true` drops `e`
* `headless:true` forces `indexElement=false`
* `headless:true` forces configure mode to `from`
* during stage execution, VM provides `AT.conf.env.document.body` as the
  effective `e`/`job.e` when no bound element exists

---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)
