# Basics — ActiveTags Job Config

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents top-level per-job config keys that are not block families (`pipelines`, `events`, `intervals`, `requests`).

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/traits/engine.js](../../src/traits/engine.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)
* [../../src/class/engine/Scheduler.js](../../src/class/engine/Scheduler.js)

---

## 1) Basics keys

Canonical basics keys are:

```txt
name
require
enabled
autorun
env
```

---

## 2) Field behavior

### `name`

Sets the job name.

* Normalized output is always a string.
* Used as the primary job identifier in runtime/controller labels and fallback tags.
* If missing or non-scalar, compiler coerces to empty string.

### `require`

Declares prerequisite jobs.

* Accepts either:
  * a space-delimited string list of job refs, or
  * an array of job refs.
* Normalizes to an array of tokens.
* Runtime uses this list as a dependency gate:
  each required job must complete at least one run (`flags.hasRun === true`) before this job's ticket is runnable.
* Useful for prerequisite/bootstrap ordering.
* Invalid non-empty types emit warning `W101_REQUIRE_INVALID` and normalize to `[]`.

### `enabled`

Controls whether the job is eligible to run.

* `true` allows the job to run.
* `false` disables job execution eligibility.
* Defaults to `true` unless explicit negative intent.
* Explicit no-intent values include: `false`, `0`, `"0"`, `"false"`, `"no"`.
* Invalid non-empty types emit warning `W102_ENABLE_INVALID`.

### `autorun`

Declares which pipelines should autorun at startup enqueue.

* Accepts `boolean|string|array`.
* Normalizes to an array of pipeline keys.
* `true` (or omitted) normalizes to `["__DEFAULT__"]` (default pipeline only).
* `false` normalizes to `[]` (no autorun pipelines).
* String/array values normalize to explicit pipeline key list.
* Invalid type emits warning `W201_AUTORUN_INVALID` and falls back to `["__DEFAULT__"]`.

Runtime note:

* Autorun list is consumed by `AT.enqueueAll()`.
* `AT.start()` does not call `enqueueAll()` automatically in the current runtime, so startup autorun behavior is typically:
  `await AT.start(); AT.enqueueAll("startup");`

### `env`

User-designated workspace for arbitrary data.

* Accepts object/hash input.
* Normalized output is always an object/hash.
* Intended as user-space context storage on job schema.
* Invalid non-empty types emit warning `W103_ENV_INVALID` and normalize to `{}`.

---

## 3) Canonical spelling note

Use `enabled`, not `enable`.

Master v1 normalizes top-level `enabled` and `autorun` directly.
Legacy-looking forms such as `enable.enabled` in older examples are not part of the current exported schema shape from `Master._exportShape(...)`.

---

## 4) Runtime usage

Current core runtime usage of basics keys:

* `enabled`:
  read by `AT.enqueueAll()` as `job.config.schema.enabled` gate.
* `autorun`:
  read by `AT.enqueueAll()` as pipeline key list (`"__DEFAULT__"` maps to `"default"`).
* `require`:
  copied into runtime tickets as `ticket.require`, then enforced by Scheduler dependency gate.
* `name`:
  used as job/config identity fallback in several controller/runtime tags.
* `env`:
  normalized in schema output but currently treated as user-space data (no active core consumer in this repo path).

---

## 5) Minimal example

Input:

```js
{
  name: "test-job",
  require: "bootstrap-job auth-job",
  enabled: true,
  autorun: true,
  env: { cartId: "abc123", retryCount: 0 }
}
```

Compiled basics:

```js
{
  name: "test-job",
  require: ["bootstrap-job", "auth-job"],
  enabled: true,
  autorun: ["__DEFAULT__"],
  env: { cartId: "abc123", retryCount: 0 }
}
```

---

## See also

* [Top-Level Job Config](./TOP_LEVEL_CONFIG.md)
* [Pipelines](./PIPELINES.md)
* [Intervals](./INTERVALS.md)
* [Events](./EVENTS.md)
* [Requests](./REQUESTS.md)
* [Configuration Model](./CONFIGURATION.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
