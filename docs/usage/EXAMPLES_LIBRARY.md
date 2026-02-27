# Examples Library — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This page maps key repository examples to runtime concepts.

---

## Primary boot example

* [../../examples/test1.html](../../examples/test1.html)

Demonstrates:

* module loading order
* runtime construction/start
* active element markup patterns
* event/interval/runtime toggles

---

## Job configuration example

* [../../examples/test-job.js](../../examples/test-job.js)

Demonstrates:

* events block
* intervals block
* pipeline definitions
* request and shape config
* mixed op styles (string/object stages)

---

## Pipeline callable examples

* [../../examples/testPipe.js](../../examples/testPipe.js)

Demonstrates user-defined callable stage functions used by example pipelines.

---

## Additional example artifacts

* [../../examples/baseConfig.json](../../examples/baseConfig.json)
* [../../examples/ATDefaultConf.js](../../examples/ATDefaultConf.js)
* [../../examples/jumjum.import.js](../../examples/jumjum.import.js)

---

## Inject-from-file demos

* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
* [../../examples/inject/fromFileString/injectFromFile.html](../../examples/inject/fromFileString/injectFromFile.html)

Demonstrates:

* fetching local fragments with `http.send`
* patching DOM content via `target.find` + `target.patch`
* string pipeline DSL with semicolon stage separation and named args

---

## Headless runtime demo

* [../../examples/headlessJobs/headlessJobs.html](../../examples/headlessJobs/headlessJobs.html)

Demonstrates:

* creating a headless job via `AT.runtime.createHeadlessJob(...)`
* registering and controlling intervals programmatically
* updating page state from a headless interval pipeline

---

## Usage note

Some files in `examples/` are iterative or backup variants (`~` suffix). Use the non-suffixed files as current references.

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
