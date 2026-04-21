# ActiveTags API Contract

[README](../../README.md) -> [API Index](./INDEX.md)

**(m7-js-lib-active-tags)**

> **You may paste this file directly into another project so that an LLM can correctly reason about and use the software.**
> This document defines the **public API contract only**.
> It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for `ActiveTags`, including:

* construction and startup lifecycle
* required dependencies and service contracts
* top-level runtime composition (`engine`, `jobs`, controllers, runtime helper)
* enqueue-oriented execution model

This contract does **not** define:

* private/internal helper methods
* internal queue/index implementations
* undocumented side effects
* legacy/inactive files

---

## Core concepts

### ActiveTags instance

`ActiveTags` is a runtime orchestrator that composes configuration, job registration, trigger controllers, and execution engine.

It is not a rendering framework.

### Job

A Job is a runtime identity registered in `AT.jobs`.
Most jobs are DOM-anchored (`job.e`), and headless runtime jobs may set `job.e = null`.

### Ticket

A Ticket is a single execution request managed by the Engine runtime for `(job, pipelineKey)`.

### Trigger controllers

Event, interval, and observer controllers are enqueue sources.
They do not execute pipelines directly.

---

## Fundamental guarantees

ActiveTags guarantees:

1. **Compile-first startup**  
   Runtime config is compiled before subsystems are activated.

2. **Explicit startup boundary**  
   Runtime activation begins only when `start()` is called.

3. **Controller-to-engine separation**  
   Trigger controllers enqueue execution work; Engine/VM performs execution.

4. **Deterministic stage status model**  
   Execution uses normalized stage statuses (`ok`, `wait`, `error`, `complete`).

5. **Service-backed integration**  
   Event, interval, observer, and logging behavior are delegated to required services.

---

## Module exports & integration

### Standard usage

The module exports `ActiveTags` as:

* named export: `ActiveTags`
* default export: `ActiveTags`

Primary source entry:

* `src/ActiveTags.js`

## Environment and dependency requirements

Required environment:

* browser DOM (`document` with `body` for startup)
* m7 `lib` runtime instance passed to `new ActiveTags(lib, conf?)`

Required dependency keys:

* `hash`
* `primitive.workspace`
* `dom`
* `str.interp`

Required service keys:

* `primitive.dom.eventdelegator`
* `primitive.interval`
* `primitive.dom.changeobserver`
* `primitive.log`

If required dependencies/services are unavailable, construction/startup may throw.

---

## Public API surface

## Construction

### `new ActiveTags(lib, conf?)`

Constructs an ActiveTags runtime instance.

Construction responsibilities:

* compile runtime config snapshot (`AT.conf`)
* resolve required dependencies and services
* instantiate runtime subsystems

Construction does **not** execute pipelines.

---

## Lifecycle API

### `start() -> Promise<void>`

Activates runtime behavior.

Behavior:

1. validates runtime document/body
2. performs initial DOM discovery scan
3. optionally starts observer controller
4. registers intervals and events from known jobs
5. enables intervals/events according to boot config gates

Throws if required DOM environment is not valid.

---

## Mixed-in helper API

### `autorun(opts?) -> Promise<number | { count, entries }>`

Convenience wrapper that enqueues autorun pipelines for eligible registered jobs,
then drains the engine.

This method preserves `enqueueAll()` eligibility semantics and does not execute
stages outside the engine.

### `toJob(ref) -> Job|undefined`

Resolves a job reference through JobRegistry.

### `enqueueAll(opts?) -> number | { count, entries }`

Enqueues autorun pipelines for eligible registered jobs.

This method enqueues work; it does not execute stages directly.

Object options currently include:

* `reason`
* `returnMeta`
* `internal`
* `rerun`

---

## Exposed runtime composition

After successful construction, the instance exposes these stable subsystem anchors:

* `AT.engine`
* `AT.jobs`
* `AT.runtime`
* `AT.events`
* `AT.intervals`
* `AT.observer`
* `AT.discover`
* `AT.conf`

These are intended runtime integration surfaces.

---

## Engine execution surface (via `AT.engine`)

The Engine facade provides stable runtime control methods including:

* `enqueue(jobLike, key?, opts?)`
* `tick({ ctx?, ticket?, requireJob? })`
* `drain({ max?, ticket?, requireJob?, ctx? })`
* `cancel(...)`
* `lock(...)` / `unlock(...)`

Exact scheduling internals are not part of this contract.

---

## Runtime helper surface (via `AT.runtime`)

The runtime helper provides programmatic job creation methods including:

* `createInternalJob(name, def?, opts?, e?)`
* `createJob({ name, def?, opts?, e?, headless? })`
* `createHeadlessJob(name, def?, opts?)`

Headless policy for `createJob`:

* when `headless:true`, element binding is dropped (`e` is ignored)
* when `headless:true`, `indexElement` is forced to `false` (no override path)
* when `headless:true`, configure mode is forced to `from` (`configureFrom(def)`)
* during stage execution, VM provides `AT.conf.env.document.body` as effective
  `e`/`job.e` when no bound element exists

---

## Controller behavior contract

### Discover controller

Responsible for DOM sweep and job registration.

### Event controller

Registers delegated handlers and enqueues pipelines on matching events.

### Interval controller

Registers interval definitions and enqueues pipelines on interval ticks.

### Observer controller

Translates DOM mutation batches into discover/register/unregister signals.

Controllers do not execute pipeline stages directly.

---

## Builtins and stage operations

Builtins are operation functions consumed by VM stage execution.

Builtin families include:

* `form`
* `dom`
* `error`
* `buffer`
* `target`
* `http`

The runtime uses a stage-response contract normalized to status values.

---

## Error and throw behavior

Methods may throw in these cases:

* constructor called without required `lib`
* required dependency/service resolution fails
* `start()` called without valid DOM document/body
* controller construction/start preconditions fail (missing required service wiring)

Execution-stage failures are normalized by Engine/VM status handling.

---

## Explicit non-guarantees

ActiveTags does **not** guarantee:

* rendering abstraction (virtual DOM, template engine, reactive state)
* framework-style component lifecycle APIs
* backward compatibility for legacy/inactive source files
* stability of private/internal state maps

---

## Legacy/inactive files

The following files are explicitly inactive and excluded from this contract:

* `archive/inert/ExpressionResolver.098.js`
* `archive/inert/JobConfig.removed.js`

Only active runtime files are normative.

---

## Forward compatibility

Future versions may:

* add subsystem APIs
* extend builtin namespaces
* extend configuration fields

Existing guarantees in this contract should not be weakened.

---

## Philosophy

> **Declare behavior in DOM/config. Execute deterministically in one runtime.**

---

## See also

* [API Index](./INDEX.md)
* [Happy Hacker Handbook for LLMs](./HAPPY_HACKER_HANDBOOK_LLM.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)
