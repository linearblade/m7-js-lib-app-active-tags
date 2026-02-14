

# --- begin: ABOUT.md ---

# About ActiveTags

[README](../README.md) -> [Usage TOC](./usage/TOC.md) -> [Architecture Index](./architecture/INDEX.md) -> [API Index](./api/INDEX.md)

ActiveTags is a compile-first workflow-orchestration runtime for DOM components.

It is designed for teams that want complex, reusable browser behavior without committing to a platform-owning UI framework.

## Core model

ActiveTags works as a small compiler + VM pipeline system:

1. compile behavior configuration into deterministic runtime schemas
2. enqueue work as tickets
3. execute ticket stages through a normalized status contract
4. route data and DOM focus explicitly through `buffer` and `target`

This creates predictable behavior and minimizes ad hoc glue code.

## How it works in detail

### 1) Mini compiler with a small instruction surface

ActiveTags compiles:

* top-level runtime policy (`AT.conf`)
* per-job behavior schema (`job.config.schema`)

Compilation normalizes shape, applies policy, and produces deterministic runtime inputs.

### 2) Basic VM for staged pipeline execution

Work executes as tickets through staged operations:

* `enqueue(...)` creates execution requests
* `tick(...)` advances one stage
* `drain(...)` advances until completion/limit

Stage outcomes are normalized to explicit statuses:

* `ok`
* `wait`
* `error`
* `complete`

### 3) DSL and expression injection

Pipelines can be authored with inline DSL strings for concise local behavior, while expression resolution injects runtime values at execution time.

This supports fast authoring without sacrificing structured runtime control.

### 4) Builtins for common tasks

First-party builtins cover frequent workflow operations:

* form processing
* HTTP send
* DOM patching
* error handling
* buffer conveyor operations
* target conveyor operations

### 5) Deep m7-lib service integration

ActiveTags is tightly integrated with m7 service primitives, including:

* delegated DOM events
* interval scheduling
* DOM mutation observation
* logging

Controllers translate those sources into enqueue work; they do not execute pipeline stages directly.

### 6) Multi-mode configuration for jobs

Job behavior can come from:

* inline attributes
* structured config objects
* external config references

Inline and external modes can be mixed per component. Inline attributes take precedence when both are present.

## Additional pillars worth calling out

### 7) Explicit `buffer` and `target` conveyor model

`buffer` carries stage data forward.  
`target` tracks where DOM work is applied.

Retargeting can happen in-pipeline, which reduces conditional event-handler glue and keeps operations reusable.

### 8) Strict trigger/execution separation

Events, intervals, and observer signals enqueue tickets. Engine/VM executes tickets.

This boundary improves reasoning, debugging, and reuse.

### 9) Extensibility for custom operations

Workflows can call builtins, literal functions, and symbolic lookups.

Teams can build reusable operation libraries and share them across components/projects.

### 10) Portable architecture posture

ActiveTags is transport-agnostic and workflow-centric. It can be used with:

* server-rendered HTML responses
* JSON APIs
* mixed response models

It fits legacy MVC systems, progressive enhancement flows, and framework-hosted pages.

## Compatibility

ActiveTags is written in standard JavaScript and follows an ES6+ runtime posture.

Compatibility notes:

* targets modern browser environments with ES module support
* may require modern runtime features in older/legacy browsers
* no external third-party libraries required beyond the m7 runtime/services it integrates with
* no known compatibility conflicts with other scripting on the same page when integration boundaries are respected

---

## See also

* [Introduction](./usage/INTRODUCTION.md)
* [Configuration Model](./usage/CONFIGURATION.md)
* [Runtime Lifecycle](./usage/RUNTIME_LIFECYCLE.md)
* [Builtins & Operations](./usage/OPERATIONS_BUILTINS.md)
* [System Overview](./architecture/SYSTEM_OVERVIEW.md)
* [What Makes ActiveTags Different](./WHAT_MAKES_US_DIFFERENT.md)
* [README](../README.md)


# --- end: ABOUT.md ---



# --- begin: AI_DISCLOSURE.md ---

# ⚙️ AI Disclosure Statement

This project incorporates the assistance of artificial intelligence tools in a supporting role to accelerate development and reduce repetitive labor.

Specifically, AI was used to:

* 🛠️ **Accelerate the creation of repetitive or boilerplate files**, such as configuration definitions and lookup logic.
* ✍️ **Improve documentation clarity**, formatting, and flow for both technical and general audiences.
* 🧠 **Act as a second set of eyes** for small but crucial errors — such as pointer handling, memory safety, and edge-case checks.
* 🌈 **Suggest enhancements** like emoji-infused logging to improve readability and human-friendly debug output.

---

## 🧑‍💻 Emoji Philosophy

I **like emoji**. They're easy for me to scan and read while debugging. Emoji make logs more human-friendly and give structure to otherwise noisy output.

Future versions may include a **configurable emoji-less mode** for those who prefer minimalism or need plaintext compatibility.

And hey — if you don't like them, the wonders of open source mean you're free to **delete them all**. 😄

---

## 🔧 Human-Directed Engineering

All core architecture, flow design, function strategy, and overall system engineering are **authored and owned by the developer**. AI was not used to generate the software's original design, security model, or protocol logic.

Every AI-assisted suggestion was critically reviewed, tested, and integrated under human judgment.

---

## 🤝 Philosophy

AI tools were used in the same spirit as modern compilers, linters, or search engines — as **assistants, not authors**. All decisions, final code, and system behavior remain the responsibility and intellectual output of the developer.


# --- end: AI_DISCLOSURE.md ---



# --- begin: api/ACTIVE_TAGS_API_CONTRACT.md ---

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
* top-level runtime composition (`engine`, `jobs`, controllers)
* enqueue-oriented execution model
* optional `auto.js` integration behavior

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

A Job is a runtime identity anchored to a DOM element and registered in `AT.jobs`.

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

### `auto.js` integration (optional)

When used in browser + m7-lib environment, `src/auto.js`:

* validates `window.lib` (auto mode only)
* validates `lib.hash.set`
* registers constructor at `lib.site.activeTags`

`auto.js` must not alter runtime semantics defined by this contract.

---

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

### `toJob(ref) -> Job|undefined`

Resolves a job reference through JobRegistry.

### `enqueueAll(reason?) -> number`

Enqueues autorun pipelines for eligible registered jobs.

This method enqueues work; it does not execute stages directly.

---

## Exposed runtime composition

After successful construction, the instance exposes these stable subsystem anchors:

* `AT.engine`
* `AT.jobs`
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
* `tick({ ctx?, ticket? })`
* `drain({ max?, ticket?, ctx? })`
* `cancel(...)`
* `lock(...)` / `unlock(...)`

Exact scheduling internals are not part of this contract.

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

* `src/class/expressions/ExpressionResolver.098.js`
* `src/class/job/config/JobConfig.removed.js`

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
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/ACTIVE_TAGS_API_CONTRACT.md ---



# --- begin: api/ACTIVE_TAGS.md ---

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
* instantiate registry, engine, controllers

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

* `enqueueAll(reason)`

Source: [../../src/traits/engine.js](../../src/traits/engine.js)


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/ACTIVE_TAGS.md ---



# --- begin: api/BUILTINS.md ---

# API Reference — Builtins Surface

[README](../../README.md) -> [API Index](./INDEX.md)


Builtins root export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

---

## Namespaces

### `form`

* collect
* prepare
* submit
* headers

### `dom`

* patch

### `error`

* dump
* fail

### `buffer`

* set
* get
* clear
* traverse

### `target`

* reset
* set
* fromBuffer
* toBuffer
* closest
* find
* parent
* child

### `http`

* send

---

## Operation contract posture

Operations are designed to return normalized stage-like responses for VM dispatch.

Reference status helpers:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/BUILTINS.md ---



# --- begin: api/CONTROLLERS.md ---

# API Reference — Controllers

[README](../../README.md) -> [API Index](./INDEX.md)


Controller surfaces instantiated by `ActiveTags`:

* Discover -> [../../src/class/discover/Controller.js](../../src/class/discover/Controller.js)
* Events -> [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* Intervals -> [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* Observer -> [../../src/class/observer/Controller.js](../../src/class/observer/Controller.js)

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

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/CONTROLLERS.md ---



# --- begin: api/ENGINE.md ---

# API Reference — Engine Runtime

[README](../../README.md) -> [API Index](./INDEX.md)


Engine runtime files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/EngineManager.js](../../src/class/engine/EngineManager.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## Engine facade methods

Common public methods:

* `enqueue(jobLike, key, opts)`
* `tick({ ctx, ticket })`
* `drain({ max, ticket, ctx })`
* `cancel(...)`
* `lock(...)` / `unlock(...)`

---

## Stage statuses

Normalized VM stage statuses:

* `ok`
* `wait`
* `error`
* `complete`

---

## Ticket lifecycle

Canonical ticket states are defined in engine helpers.

Ticket data includes pipeline key, cursor, buffer, target, and runtime metadata.


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/ENGINE.md ---



# --- begin: api/INDEX.md ---

# API Index — ActiveTags

[README](../../README.md) -> [API Index](./INDEX.md) -> [Usage TOC](../usage/TOC.md) -> [Architecture Index](../architecture/INDEX.md)


This directory contains API-oriented references for ActiveTags runtime surfaces.

If you are new to the project, start with:

* Usage TOC -> [../usage/TOC.md](../usage/TOC.md)
* Quick Start -> [../usage/QUICKSTART.md](../usage/QUICKSTART.md)
* Architecture Index -> [../architecture/INDEX.md](../architecture/INDEX.md)
* Project README -> [../../README.md](../../README.md)

---

## Core surfaces

* **ActiveTags Class** -> [ACTIVE_TAGS.md](./ACTIVE_TAGS.md)
* **Reference Manual (method-level)** -> [reference/INDEX.md](./reference/INDEX.md)
* **Engine Runtime** -> [ENGINE.md](./ENGINE.md)
* **Controllers** -> [CONTROLLERS.md](./CONTROLLERS.md)
* **Builtins Surface** -> [BUILTINS.md](./BUILTINS.md)
* **What Makes ActiveTags Different** -> [../WHAT_MAKES_US_DIFFERENT.md](../WHAT_MAKES_US_DIFFERENT.md)

---

## Reference entry points

* Reference Manual home -> [reference/INDEX.md](./reference/INDEX.md)
* Top-level `AT` reference -> [reference/AT.md](./reference/AT.md)
* `AT.jobs` reference -> [reference/AT_JOBS.md](./reference/AT_JOBS.md)
* `AT.discover` reference -> [reference/AT_DISCOVER.md](./reference/AT_DISCOVER.md)
* `AT.observer` reference -> [reference/AT_OBSERVER.md](./reference/AT_OBSERVER.md)
* `AT.events` reference -> [reference/AT_EVENTS.md](./reference/AT_EVENTS.md)
* `AT.intervals` reference -> [reference/AT_INTERVALS.md](./reference/AT_INTERVALS.md)
* `AT.engine` reference -> [reference/AT_ENGINE.md](./reference/AT_ENGINE.md)

---

## Contracts

* **ActiveTags API Contract (LLM/tooling-safe)** -> [ACTIVE_TAGS_API_CONTRACT.md](./ACTIVE_TAGS_API_CONTRACT.md)

Source-independent behavioral guarantees intended for tooling, integration layers, and LLM guidance.

---

## Related

* Usage docs -> [../usage/TOC.md](../usage/TOC.md)
* v098 DSL manual -> [../usage/DSL_V098.md](../usage/DSL_V098.md)
* Architecture docs -> [../architecture/INDEX.md](../architecture/INDEX.md)

---

## See also

* [ActiveTags Class](./ACTIVE_TAGS.md)
* [Reference Manual](./reference/INDEX.md)
* [Engine Runtime](./ENGINE.md)
* [Controllers](./CONTROLLERS.md)
* [Builtins Surface](./BUILTINS.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)


# --- end: api/INDEX.md ---



# --- begin: api/reference/AT_DISCOVER.md ---

# Reference — `AT.discover`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.discover` methods.

## Deep reference

* [`AT.discover` deep reference](./at-discover/INDEX.md)

## Methods

* [`scan(sel?, opts?)`](./at-discover/scan.md)
* [`registerJobs(list, opts?)`](./at-discover/register-jobs.md)
* [`sweep(sel?)`](./at-discover/sweep.md)

---

## See also

* [`AT.jobs`](./AT_JOBS.md)
* [`AT.observer`](./AT_OBSERVER.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_DISCOVER.md ---



# --- begin: api/reference/AT_ENGINE.md ---

# Reference — `AT.engine`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.engine` methods.

## Deep reference

* [`AT.engine` deep reference](./at-engine/INDEX.md)

## Methods

* [`tick({ ctx?, ticket? } = {})`](./at-engine/tick.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./at-engine/drain.md)
* [`getTicketByJob(jobLike, key?)`](./at-engine/get-ticket-by-job.md)
* [`enqueue(jobLike, key = "default", opts?)`](./at-engine/enqueue.md)
* [`lockTicket(ticketId, lock?)`](./at-engine/lock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./at-engine/lock.md)
* [`unlockTicket(ticketId, token?)`](./at-engine/unlock-ticket.md)
* [`unlock(jobLike, key = "default", token?)`](./at-engine/unlock.md)
* [`cancel(jobLike, key = "default")`](./at-engine/cancel.md)
* [`cancelTicket(ticketId)`](./at-engine/cancel-ticket.md)

---

## See also

* [`AT.events`](./AT_EVENTS.md)
* [`AT.intervals`](./AT_INTERVALS.md)
* [v098 DSL Manual](../../usage/DSL_V098.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_ENGINE.md ---



# --- begin: api/reference/AT_EVENTS.md ---

# Reference — `AT.events`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.events` methods.

## Deep reference

* [`AT.events` deep reference](./at-events/INDEX.md)

## Methods

* [`destroy()`](./at-events/destroy.md)
* [`registerAll()`](./at-events/register-all.md)
* [`register(jobLike)`](./at-events/register.md)
* [`remove(jobLike)`](./at-events/remove.md)
* [`listJob(jobLike)`](./at-events/list-job.md)
* [`listJobs(name = true)`](./at-events/list-jobs.md)
* [`enable(jobLike, eventName?)`](./at-events/enable.md)
* [`disable(jobLike, eventName?)`](./at-events/disable.md)
* [`on(jobLike?, eventName?)`](./at-events/on.md)
* [`off(jobLike?, eventName?)`](./at-events/off.md)

---

## See also

* [`AT.engine`](./AT_ENGINE.md)
* [`AT.jobs`](./AT_JOBS.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_EVENTS.md ---



# --- begin: api/reference/AT_INTERVALS.md ---

# Reference — `AT.intervals`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.intervals` methods.

## Deep reference

* [`AT.intervals` deep reference](./at-intervals/INDEX.md)

## Methods

* [`destroy()`](./at-intervals/destroy.md)
* [`registerAll()`](./at-intervals/register-all.md)
* [`register(jobLike)`](./at-intervals/register.md)
* [`remove(jobLike)`](./at-intervals/remove.md)
* [`listJob(jobLike)`](./at-intervals/list-job.md)
* [`listJobs(name = true)`](./at-intervals/list-jobs.md)
* [`on(jobLike?, intervalName?)`](./at-intervals/on.md)
* [`off(jobLike?, intervalName?)`](./at-intervals/off.md)
* [`enable(jobLike, intervalName?)`](./at-intervals/enable.md)
* [`disable(jobLike, intervalName?)`](./at-intervals/disable.md)

---

## See also

* [`AT.engine`](./AT_ENGINE.md)
* [`AT.jobs`](./AT_JOBS.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_INTERVALS.md ---



# --- begin: api/reference/AT_JOBS.md ---

# Reference — `AT.jobs`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.jobs` methods.

## Deep reference

* [`AT.jobs` deep reference](./at-jobs/INDEX.md)

## Methods

* [`resolve(x)`](./at-jobs/resolve.md)
* [`nextId()`](./at-jobs/next-id.md)
* [`hasElement(el)`](./at-jobs/has-element.md)
* [`getIdByElement(el)`](./at-jobs/get-id-by-element.md)
* [`getById(id)`](./at-jobs/get-by-id.md)
* [`getByElement(el)`](./at-jobs/get-by-element.md)
* [`getByName(name)`](./at-jobs/get-by-name.md)
* [`list()`](./at-jobs/list.md)
* [`listByStatus(status)`](./at-jobs/list-by-status.md)
* [`listByName(name)`](./at-jobs/list-by-name.md)
* [`register(job)`](./at-jobs/register.md)
* [`unregister(jobOrIdOrEl, opts?)`](./at-jobs/unregister.md)
* [`setName(job, name)`](./at-jobs/set-name.md)

---

## See also

* [`AT.discover`](./AT_DISCOVER.md)
* [`AT.observer`](./AT_OBSERVER.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_JOBS.md ---



# --- begin: api/reference/AT_OBSERVER.md ---

# Reference — `AT.observer`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.observer` methods.

## Deep reference

* [`AT.observer` deep reference](./at-observer/INDEX.md)

## Methods

* [`start()`](./at-observer/start.md)
* [`stop()`](./at-observer/stop.md)
* [`setSelectors(selectorSpecs)`](./at-observer/set-selectors.md)

---

## See also

* [`AT.discover`](./AT_DISCOVER.md)
* [`AT.jobs`](./AT_JOBS.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT_OBSERVER.md ---



# --- begin: api/reference/at-discover/INDEX.md ---

# Deep Reference — `AT.discover`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/discover/Controller.js](../../../../src/class/discover/Controller.js)

---

## Method Pages

* [`scan(sel?, opts?)`](./scan.md)
* [`registerJobs(list, opts?)`](./register-jobs.md)
* [`sweep(sel?)`](./sweep.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-discover/INDEX.md ---



# --- begin: api/reference/at-discover/register-jobs.md ---

# Method — `registerJobs(list, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`registerJobs(list, opts?)`](./register-jobs.md)

## `registerJobs(list, opts?)`

### Signature

`registerJobs(list, opts?) -> Promise<Job[]>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `list` | `Array<Element>|ArrayLike<Element>` | Yes | Candidate elements to register as jobs. |
| `opts` | `Object` | No | Overrides. Supported keys: `ignoreExisting`, `evalEnabled`, `evalType`, `importEnabled`, `importPath`. |

### Returns

Array of jobs corresponding to processed elements.

### Side effects

* Creates `Job` instances for new elements.
* Registers jobs via `AT.jobs.register(...)`.
* Merges job config overrides and calls `job.configure(jobConf)`.
* Emits configuration diagnostics via `configReporter(...)`.
* Updates job name index via `AT.jobs.setName(...)`.

### Failure modes

* Skips non-DOM values silently.
* May throw from `Job` construction, registry registration, or `job.configure(...)`.

### Example

```js
const jobs = await AT.discover.registerJobs(nodeList, {
  importEnabled: true,
  importPath: "/pipelines"
});
```

### Related methods

* [`scan(sel?, opts?)`](./scan.md)
* [`AT.jobs.register(job)`](../at-jobs/register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-discover/register-jobs.md ---



# --- begin: api/reference/at-discover/scan.md ---

# Method — `scan(sel?, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`scan(sel?, opts?)`](./scan.md)

## `scan(sel?, opts?)`

### Signature

`scan(sel?, opts?) -> Promise<Job[]>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sel` | `string|Element|Array<string|Element>|null` | No | Selector(s) or element(s) to scan. Defaults to `conf.boot.selector`. |
| `opts` | `Object` | No | Registration overrides forwarded to `registerJobs()`. |

### Returns

Array of registered jobs for discovered candidates. Can include existing jobs unless `ignoreExisting` is enabled.

### Side effects

* Calls `sweep(sel)` to collect candidates.
* Calls `registerJobs(list, opts)` and may create/configure/register new jobs.

### Failure modes

* Returns `[]` when no candidates are discovered.
* Propagates `sweep()` and `registerJobs()` exceptions.

### Example

```js
const jobs = await AT.discover.scan("[at]");
```

### Related methods

* [`registerJobs(list, opts?)`](./register-jobs.md)
* [`sweep(sel?)`](./sweep.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-discover/scan.md ---



# --- begin: api/reference/at-discover/sweep.md ---

# Method — `sweep(sel?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`sweep(sel?)`](./sweep.md)

## `sweep(sel?)`

### Signature

`sweep(sel?) -> Element[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sel` | `string|Element|Array<string|Element>|null` | No | Selector(s) or element(s). Defaults to `conf.boot.selector`. |

### Returns

De-duplicated array of matching DOM elements.

### Side effects

None. `sweep()` is discovery-only and does not register jobs.

### Failure modes

* Throws if `conf.env` is missing.
* Throws if `conf.env.document` is missing or invalid.

### Example

```js
const nodes = AT.discover.sweep(["[at]", "[data-at]"]);
```

### Related methods

* [`scan(sel?, opts?)`](./scan.md)
* [`AT.observer.start()`](../at-observer/start.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-discover/sweep.md ---



# --- begin: api/reference/at-engine/cancel-ticket.md ---

# Method — `cancelTicket(ticketId)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`cancelTicket(ticketId)`](./cancel-ticket.md)

## `cancelTicket(ticketId)`

### Signature

`cancelTicket(ticketId) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |

### Returns

`1` when cancellation/cleanup succeeded, `0` when ticket record is missing.

### Side effects

* Deletes ticket from global runtime ticket index.
* Removes ticket from active slot or job queue when present.
* Cleans alias mapping defensively when it points to the target ticket.
* May mark job runnable if queued work remains and job is not locked.

### Failure modes

Returns `0` for unknown ticket id.

### Example

```js
AT.engine.cancelTicket(ticket.id);
```

### Related methods

* [`cancel(jobLike, key = "default")`](./cancel.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/cancel-ticket.md ---



# --- begin: api/reference/at-engine/cancel.md ---

# Method — `cancel(jobLike, key = "default")`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`cancel(jobLike, key = "default")`](./cancel.md)

## `cancel(jobLike, key = "default")`

### Signature

`cancel(jobLike, key = "default") -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |

### Returns

`1` when the alias ticket is found and cancelled, otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `cancelTicket(...)`.

### Failure modes

Returns `0` when no active alias ticket exists.

### Example

```js
AT.engine.cancel(job, "default");
```

### Related methods

* [`cancelTicket(ticketId)`](./cancel-ticket.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/cancel.md ---



# --- begin: api/reference/at-engine/drain.md ---

# Method — `drain({ max?, ticket?, ctx? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)

## `drain({ max?, ticket?, ctx? } = {})`

### Signature

`drain({ max?, ticket?, ctx? } = {}) -> Promise<number>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | No | Maximum tick iterations. Defaults to `1000`. |
| `ticket` | `string|Ticket` | No | Optional targeted ticket id/object for scoped draining. |
| `ctx` | `Object` | No | Execution context forwarded to each tick. |

### Returns

Number of tick iterations that performed work.

### Side effects

Repeatedly invokes `tick(...)` until no work remains or `max` is reached.

### Failure modes

Stops early when `tick()` reports no work (`didWork: false`).

### Example

```js
await AT.engine.drain({ max: 200 });
```

### Related methods

* [`tick({ ctx?, ticket? } = {})`](./tick.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/drain.md ---



# --- begin: api/reference/at-engine/enqueue.md ---

# Method — `enqueue(jobLike, key = "default", opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

## `enqueue(jobLike, key = "default", opts?)`

### Signature

`enqueue(jobLike, key = "default", opts?) -> Ticket`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string` | No | Pipeline key used for aliasing (`jobId + pipelineKey`). |
| `opts` | `Object` | No | Optional enqueue payload. |
| `opts.inputs` | `Object` | No | Runtime inputs for stage execution. |
| `opts.priority` | `number` | No | Scheduling priority metadata. Defaults to `0`. |
| `opts.meta` | `Object` | No | Diagnostic metadata attached to the ticket. |

### Returns

Ticket object for that alias. Existing active alias tickets are reused (dedupe behavior).

### Side effects

* Creates/updates runtime alias and ticket indexes.
* Pushes new ticket into per-job queue when new.
* May mark job runnable in scheduler.
* May fire `onEnqueue` hook.

### Failure modes

Throws if job cannot be resolved to a registered job with id.

### Example

```js
const ticket = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "api" }
});
```

### Related methods

* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/enqueue.md ---



# --- begin: api/reference/at-engine/get-ticket-by-job.md ---

# Method — `getTicketByJob(jobLike, key?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

## `getTicketByJob(jobLike, key?)`

### Signature

`getTicketByJob(jobLike, key?) -> Ticket|null|Ticket[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string|undefined` | No | Pipeline key. When omitted, returns all active tickets for job. |

### Returns

* With `key`: single `Ticket` or `null`.
* Without `key`: `Ticket[]` (possibly empty).

### Side effects

None.

### Failure modes

Unresolved job returns `null` (keyed mode) or `[]` (all-tickets mode).

### Example

```js
const one = AT.engine.getTicketByJob(job, "default");
const all = AT.engine.getTicketByJob(job);
```

### Related methods

* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)
* [`cancel(jobLike, key = "default")`](./cancel.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/get-ticket-by-job.md ---



# --- begin: api/reference/at-engine/INDEX.md ---

# Deep Reference — `AT.engine`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/engine/Engine.js](../../../../src/class/engine/Engine.js)
* [../../../../src/class/engine/EngineManager.js](../../../../src/class/engine/EngineManager.js)
* [../../../../src/class/engine/Tick.js](../../../../src/class/engine/Tick.js)

---

## Method Pages

* [`tick({ ctx?, ticket? } = {})`](./tick.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)
* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)
* [`lockTicket(ticketId, lock?)`](./lock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./lock.md)
* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)
* [`unlock(jobLike, key = "default", token?)`](./unlock.md)
* [`cancel(jobLike, key = "default")`](./cancel.md)
* [`cancelTicket(ticketId)`](./cancel-ticket.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/INDEX.md ---



# --- begin: api/reference/at-engine/lock-ticket.md ---

# Method — `lockTicket(ticketId, lock?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`lockTicket(ticketId, lock?)`](./lock-ticket.md)

## `lockTicket(ticketId, lock?)`

### Signature

`lockTicket(ticketId, lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `lock` | `Object` | No | Optional lock object. Default lock is generated when omitted. |

### Returns

`1` when ticket lock was set, otherwise `0`.

### Side effects

Mutates `ticket.lock` on the targeted ticket.

### Failure modes

Returns `0` when ticket record is missing.

### Example

```js
AT.engine.lockTicket(ticket.id, { type: "ticket", token: "manual-1" });
```

### Related methods

* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./lock.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/lock-ticket.md ---



# --- begin: api/reference/at-engine/lock.md ---

# Method — `lock(jobLike, key = "default", lock?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`lock(jobLike, key = "default", lock?)`](./lock.md)

## `lock(jobLike, key = "default", lock?)`

### Signature

`lock(jobLike, key = "default", lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `lock` | `Object` | No | Optional lock object. Default `jobKey` lock is generated when omitted. |

### Returns

`1` when active alias ticket was found and locked; otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `lockTicket(...)`.

### Failure modes

Returns `0` when no active ticket exists for `(job, key)`.

### Example

```js
AT.engine.lock(job, "default");
```

### Related methods

* [`unlock(jobLike, key = "default", token?)`](./unlock.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/lock.md ---



# --- begin: api/reference/at-engine/tick.md ---

# Method — `tick({ ctx?, ticket? } = {})`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`tick({ ctx?, ticket? } = {})`](./tick.md)

## `tick({ ctx?, ticket? } = {})`

### Signature

`tick({ ctx?, ticket? } = {}) -> Promise<Object>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ctx` | `Object` | No | Execution context forwarded to VM operations. |
| `ticket` | `string|Ticket|null` | No | Optional targeted ticket id/object. When omitted, scheduler-selected execution is used. |

### Returns

Normalized tick trace object (wrapped in a promise) describing one execution step.

### Side effects

* May promote queued ticket to active.
* Executes one VM stage.
* Updates ticket/job runtime state.
* Emits engine hooks (`onStage`, `onComplete`, `onError`, etc.) as applicable.

### Failure modes

* Does not throw VM step errors outward; they are normalized into error traces.
* Returns trace with `didWork: false` when nothing runnable, missing ticket, locked state, etc.

### Example

```js
const trace = await AT.engine.tick();
if (!trace.didWork) {
  // engine is idle or blocked
}
```

### Related methods

* [`drain({ max?, ticket?, ctx? } = {})`](./drain.md)
* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/tick.md ---



# --- begin: api/reference/at-engine/unlock-ticket.md ---

# Method — `unlockTicket(ticketId, token?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)

## `unlockTicket(ticketId, token?)`

### Signature

`unlockTicket(ticketId, token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `token` | `string` | No | Optional lock token guard. If provided and mismatch occurs, unlock fails. |

### Returns

`1` on success (or already unlocked), `0` on missing ticket or token mismatch.

### Side effects

* Clears `ticket.lock`.
* May mark job runnable again if it still has pending work.

### Failure modes

Token mismatch returns `0` and keeps lock unchanged.

### Example

```js
AT.engine.unlockTicket(ticket.id, "manual-1");
```

### Related methods

* [`lockTicket(ticketId, lock?)`](./lock-ticket.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/unlock-ticket.md ---



# --- begin: api/reference/at-engine/unlock.md ---

# Method — `unlock(jobLike, key = "default", token?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`unlock(jobLike, key = "default", token?)`](./unlock.md)

## `unlock(jobLike, key = "default", token?)`

### Signature

`unlock(jobLike, key = "default", token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `token` | `string` | No | Optional token passed through to `unlockTicket(...)`. |

### Returns

`1` when alias ticket unlock succeeds (or was already unlocked), otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `unlockTicket(...)`.

### Failure modes

Returns `0` when no active alias ticket exists or token check fails.

### Example

```js
AT.engine.unlock(job, "default");
```

### Related methods

* [`lock(jobLike, key = "default", lock?)`](./lock.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-engine/unlock.md ---



# --- begin: api/reference/at-events/destroy.md ---

# Method — `destroy()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`destroy()`](./destroy.md)

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down this controller's runtime registrations. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to uninstall active delegated handlers.
* Clears internal registry (`jobId -> event map`).

### Failure modes

Depends on delegator teardown behavior; otherwise safe to call repeatedly.

### Example

```js
AT.events.destroy();
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/destroy.md ---



# --- begin: api/reference/at-events/disable.md ---

# Method — `disable(jobLike, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`disable(jobLike, eventName?)`](./disable.md)

## `disable(jobLike, eventName?)`

### Signature

`disable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, disables all bindings for job. |

### Returns

`true` when at least one targeted binding changed from enabled to disabled.

### Side effects

* Uninstalls active handlers for targeted bindings (`disable` implies `off`).
* Mutates logical `enabled` flags.

### Failure modes

Returns `false` when job cannot be resolved, no event entry exists, or named event is missing.

### Example

```js
AT.events.disable(job, "submit");
```

### Related methods

* [`enable(jobLike, eventName?)`](./enable.md)
* [`off(jobLike?, eventName?)`](./off.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/disable.md ---



# --- begin: api/reference/at-events/enable.md ---

# Method — `enable(jobLike, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`enable(jobLike, eventName?)`](./enable.md)

## `enable(jobLike, eventName?)`

### Signature

`enable(jobLike, eventName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `eventName` | `string` | No | Optional binding name; when omitted, enables all bindings for job. |

### Returns

`true` when at least one target is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

* Returns `false` when job cannot be resolved, no registry entry exists, or named event is missing.
* Does not install handlers.

### Example

```js
AT.events.enable(job, "submit");
AT.events.on(job, "submit");
```

### Related methods

* [`disable(jobLike, eventName?)`](./disable.md)
* [`on(jobLike?, eventName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/enable.md ---



# --- begin: api/reference/at-events/INDEX.md ---

# Deep Reference — `AT.events`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/event/Controller.js](../../../../src/class/event/Controller.js)

---

## Method Pages

* [`destroy()`](./destroy.md)
* [`registerAll()`](./register-all.md)
* [`register(jobLike)`](./register.md)
* [`remove(jobLike)`](./remove.md)
* [`listJob(jobLike)`](./list-job.md)
* [`listJobs(name = true)`](./list-jobs.md)
* [`enable(jobLike, eventName?)`](./enable.md)
* [`disable(jobLike, eventName?)`](./disable.md)
* [`on(jobLike?, eventName?)`](./on.md)
* [`off(jobLike?, eventName?)`](./off.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/INDEX.md ---



# --- begin: api/reference/at-events/list-job.md ---

# Method — `listJob(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`listJob(jobLike)`](./list-job.md)

## `listJob(jobLike)`

### Signature

`listJob(jobLike) -> Object`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Plain object keyed by event binding name with values `{ enabled, on }`.

### Side effects

None.

### Failure modes

Returns `{}` when the job cannot be resolved or has no registered events.

### Example

```js
const state = AT.events.listJob(job);
```

### Related methods

* [`listJobs(name = true)`](./list-jobs.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/list-job.md ---



# --- begin: api/reference/at-events/list-jobs.md ---

# Method — `listJobs(name = true)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`listJobs(name = true)`](./list-jobs.md)

## `listJobs(name = true)`

### Signature

`listJobs(name = true) -> string[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `boolean` | No | `true` returns best-effort job names; `false` returns job ids. |

### Returns

Array of identifiers for jobs currently present in the event registry.

### Side effects

None.

### Failure modes

Returns `[]` when no job entries are registered.

### Example

```js
const ids = AT.events.listJobs(false);
const labels = AT.events.listJobs(true);
```

### Related methods

* [`listJob(jobLike)`](./list-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/list-jobs.md ---



# --- begin: api/reference/at-events/off.md ---

# Method — `off(jobLike?, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`off(jobLike?, eventName?)`](./off.md)

## `off(jobLike?, eventName?)`

### Signature

`off(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully uninstalled.

### Side effects

* Runs stored unsubscriber `offFn()` when present.
* Calls defensive `delegator.offTag(runtimeTag)` cleanup when runtime tag exists.
* Clears runtime state (`on`, `runtimeTag`, `offFn`) for each affected binding.

### Failure modes

Returns `0` for unresolved jobs, missing bindings, or bindings that are already off.

### Example

```js
AT.events.off(job, "submit");
AT.events.off(); // global teardown
```

### Related methods

* [`on(jobLike?, eventName?)`](./on.md)
* [`destroy()`](./destroy.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/off.md ---



# --- begin: api/reference/at-events/on.md ---

# Method — `on(jobLike?, eventName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`on(jobLike?, eventName?)`](./on.md)

## `on(jobLike?, eventName?)`

### Signature

`on(jobLike?, eventName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job. Omit to apply globally across registry jobs. |
| `eventName` | `string` | No | Optional binding name. Omit to target all bindings for selected job(s). |

### Returns

Number of delegated handlers successfully installed.

### Side effects

* Installs handlers via `delegator.on(...)` for enabled, currently-off bindings.
* Records runtime state (`on`, `runtimeTag`, `offFn`) per binding.

### Failure modes

* Returns `0` when no eligible bindings are found.
* Skips disabled bindings and already-installed bindings.
* Skips bindings with invalid event/pipeline definitions.

### Example

```js
AT.events.registerAll();
AT.events.on(); // global activation
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/on.md ---



# --- begin: api/reference/at-events/register-all.md ---

# Method — `registerAll()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`registerAll()`](./register-all.md)

## `registerAll()`

### Signature

`registerAll() -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Scans all jobs in the registry. |

### Returns

Number of jobs for which `register(job)` was invoked.

### Side effects

Populates or refreshes event entries in the internal controller registry.

### Failure modes

* Returns `0` when no jobs are available.
* Skips jobs where `job.config.schema.enable.enabled` is disabled.

### Example

```js
const jobsProcessed = AT.events.registerAll();
```

### Related methods

* [`register(jobLike)`](./register.md)
* [`on(jobLike?, eventName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/register-all.md ---



# --- begin: api/reference/at-events/register.md ---

# Method — `register(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`register(jobLike)`](./register.md)

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of event entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.events`.
* Stores normalized entries with runtime state fields (`enabled`, `on`, `runtimeTag`, `offFn`).
* Re-registering replaces definitions and resets `on` state in the registry entry.

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or events config is missing/invalid.
* Skips event records missing `event` or `pipeline`.

### Example

```js
const added = AT.events.register(job);
```

### Related methods

* [`registerAll()`](./register-all.md)
* [`remove(jobLike)`](./remove.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/register.md ---



# --- begin: api/reference/at-events/remove.md ---

# Method — `remove(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.events` Deep Reference](./INDEX.md) -> [`remove(jobLike)`](./remove.md)

## `remove(jobLike)`

### Signature

`remove(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Number of event entries removed for that job.

### Side effects

* Calls `off(job)` to uninstall active handlers.
* Deletes job event map from registry.

### Failure modes

Returns `0` when the job cannot be resolved or no event map exists.

### Example

```js
AT.events.remove(job);
```

### Related methods

* [`off(jobLike?, eventName?)`](./off.md)
* [`register(jobLike)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-events/remove.md ---



# --- begin: api/reference/at-intervals/destroy.md ---

# Method — `destroy()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`destroy()`](./destroy.md)

## `destroy()`

### Signature

`destroy() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Fully tears down interval runtime state for this controller. |

### Returns

No return value.

### Side effects

* Calls `off()` globally to cancel active interval timers.
* Clears internal interval registry.

### Failure modes

Safe to call repeatedly; behavior depends on interval service cancellation semantics.

### Example

```js
AT.intervals.destroy();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`registerAll()`](./register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/destroy.md ---



# --- begin: api/reference/at-intervals/disable.md ---

# Method — `disable(jobLike, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`disable(jobLike, intervalName?)`](./disable.md)

## `disable(jobLike, intervalName?)`

### Signature

`disable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to disable all for the job. |

### Returns

`true` when at least one targeted interval changed from enabled to disabled.

### Side effects

* Stops running intervals for targeted entries (`disable` implies runtime `off`).
* Sets logical `enabled = false` for targeted entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.disable(job, "refresh");
```

### Related methods

* [`enable(jobLike, intervalName?)`](./enable.md)
* [`off(jobLike?, intervalName?)`](./off.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/disable.md ---



# --- begin: api/reference/at-intervals/enable.md ---

# Method — `enable(jobLike, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`enable(jobLike, intervalName?)`](./enable.md)

## `enable(jobLike, intervalName?)`

### Signature

`enable(jobLike, intervalName?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `intervalName` | `string` | No | Optional interval name; omit to enable all for the job. |

### Returns

`true` when at least one targeted interval is enabled (or when a named target exists and is set to true).

### Side effects

Mutates logical `enabled` flags in registry entries.

### Failure modes

Returns `false` when job cannot be resolved, no interval map exists, or named interval is missing.

### Example

```js
AT.intervals.enable(job, "refresh");
AT.intervals.on(job, "refresh");
```

### Related methods

* [`disable(jobLike, intervalName?)`](./disable.md)
* [`on(jobLike?, intervalName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/enable.md ---



# --- begin: api/reference/at-intervals/INDEX.md ---

# Deep Reference — `AT.intervals`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/interval/Controller.js](../../../../src/class/interval/Controller.js)

---

## Method Pages

* [`destroy()`](./destroy.md)
* [`registerAll()`](./register-all.md)
* [`register(jobLike)`](./register.md)
* [`remove(jobLike)`](./remove.md)
* [`listJob(jobLike)`](./list-job.md)
* [`listJobs(name = true)`](./list-jobs.md)
* [`on(jobLike?, intervalName?)`](./on.md)
* [`off(jobLike?, intervalName?)`](./off.md)
* [`enable(jobLike, intervalName?)`](./enable.md)
* [`disable(jobLike, intervalName?)`](./disable.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/INDEX.md ---



# --- begin: api/reference/at-intervals/list-job.md ---

# Method — `listJob(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`listJob(jobLike)`](./list-job.md)

## `listJob(jobLike)`

### Signature

`listJob(jobLike) -> Object`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Plain object keyed by interval name with values `{ enabled, on }`.

### Side effects

None.

### Failure modes

Returns `{}` when job cannot be resolved or has no registered intervals.

### Example

```js
const state = AT.intervals.listJob(job);
```

### Related methods

* [`listJobs(name = true)`](./list-jobs.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/list-job.md ---



# --- begin: api/reference/at-intervals/list-jobs.md ---

# Method — `listJobs(name = true)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`listJobs(name = true)`](./list-jobs.md)

## `listJobs(name = true)`

### Signature

`listJobs(name = true) -> string[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `boolean` | No | `true` returns names (when available); `false` returns job ids. |

### Returns

Array of identifiers for jobs that currently have interval entries.

### Side effects

None.

### Failure modes

Returns `[]` when interval registry is empty.

### Example

```js
const ids = AT.intervals.listJobs(false);
```

### Related methods

* [`listJob(jobLike)`](./list-job.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/list-jobs.md ---



# --- begin: api/reference/at-intervals/off.md ---

# Method — `off(jobLike?, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`off(jobLike?, intervalName?)`](./off.md)

## `off(jobLike?, intervalName?)`

### Signature

`off(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global deactivation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully deactivated.

### Side effects

* Cancels runtime timers via `intervalManager.cancel(runtimeName)`.
* Clears runtime state (`on`, `runtimeName`) on affected entries.

### Failure modes

Returns `0` for unresolved jobs, missing intervals, or intervals already off.

### Example

```js
AT.intervals.off(job, "refresh");
AT.intervals.off();
```

### Related methods

* [`on(jobLike?, intervalName?)`](./on.md)
* [`disable(jobLike, intervalName?)`](./disable.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/off.md ---



# --- begin: api/reference/at-intervals/on.md ---

# Method — `on(jobLike?, intervalName?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`on(jobLike?, intervalName?)`](./on.md)

## `on(jobLike?, intervalName?)`

### Signature

`on(jobLike?, intervalName?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object|null` | No | Target job; omit for global activation. |
| `intervalName` | `string` | No | Optional interval name. Omit to target all intervals for selected job(s). |

### Returns

Number of interval timers successfully activated.

### Side effects

* Registers runtime interval definitions with `intervalManager.register(...)`.
* Starts timers via `intervalManager.start(runtimeName)`.
* On each tick, enqueues pipeline work and drains engine for that ticket.
* Marks entries `on = true` and records `runtimeName`.

### Failure modes

* Returns `0` when no eligible intervals are found.
* Skips disabled, already-on, or structurally invalid interval records.

### Example

```js
AT.intervals.registerAll();
AT.intervals.on();
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`enable(jobLike, intervalName?)`](./enable.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/on.md ---



# --- begin: api/reference/at-intervals/register-all.md ---

# Method — `registerAll()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`registerAll()`](./register-all.md)

## `registerAll()`

### Signature

`registerAll() -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Scans all jobs in the registry. |

### Returns

Number of jobs for which `register(job)` was invoked.

### Side effects

Populates or refreshes per-job interval entries in the internal registry.

### Failure modes

* Returns `0` when no jobs are available.
* Skips jobs where `job.config.schema.enable.enabled` is disabled.

### Example

```js
const jobsProcessed = AT.intervals.registerAll();
```

### Related methods

* [`register(jobLike)`](./register.md)
* [`on(jobLike?, intervalName?)`](./on.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/register-all.md ---



# --- begin: api/reference/at-intervals/register.md ---

# Method — `register(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`register(jobLike)`](./register.md)

## `register(jobLike)`

### Signature

`register(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Reference resolved by `toJob()`. |

### Returns

Number of interval entries added/replaced for that job.

### Side effects

* Reads `job.config.schema.intervals`.
* Stores normalized entries with logical/runtime fields (`enabled`, `on`, `def`).
* Re-registering replaces definitions and resets runtime-on state in registry entries.

### Failure modes

* Returns `0` when job cannot be resolved, has no id, or intervals config is missing/invalid.
* Skips records missing positive `repeat` or non-empty `pipeline`.

### Example

```js
const added = AT.intervals.register(job);
```

### Related methods

* [`registerAll()`](./register-all.md)
* [`remove(jobLike)`](./remove.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/register.md ---



# --- begin: api/reference/at-intervals/remove.md ---

# Method — `remove(jobLike)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.intervals` Deep Reference](./INDEX.md) -> [`remove(jobLike)`](./remove.md)

## `remove(jobLike)`

### Signature

`remove(jobLike) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |

### Returns

Number of interval entries removed for that job.

### Side effects

* Calls `off(job)` first to cancel active timers.
* Deletes the job interval map from registry.

### Failure modes

Returns `0` when job cannot be resolved or no interval map exists.

### Example

```js
AT.intervals.remove(job);
```

### Related methods

* [`off(jobLike?, intervalName?)`](./off.md)
* [`register(jobLike)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-intervals/remove.md ---



# --- begin: api/reference/at-jobs/get-by-element.md ---

# Method — `getByElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getByElement(el)`](./get-by-element.md)

## `getByElement(el)`

### Signature

`getByElement(el) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Registered job for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no element mapping exists.

### Example

```js
const job = AT.jobs.getByElement(el);
```

### Related methods

* [`getIdByElement(el)`](./get-id-by-element.md)
* [`hasElement(el)`](./has-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/get-by-element.md ---



# --- begin: api/reference/at-jobs/get-by-id.md ---

# Method — `getById(id)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getById(id)`](./get-by-id.md)

## `getById(id)`

### Signature

`getById(id) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Canonical job id. |

### Returns

Registered job for that id, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when id is unknown.

### Example

```js
const job = AT.jobs.getById("DEFAULT__at-1");
```

### Related methods

* [`resolve(x)`](./resolve.md)
* [`getByName(name)`](./get-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/get-by-id.md ---



# --- begin: api/reference/at-jobs/get-by-name.md ---

# Method — `getByName(name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getByName(name)`](./get-by-name.md)

## `getByName(name)`

### Signature

`getByName(name) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical job name. |

### Returns

A single resolved job only when name resolution is unambiguous; otherwise `null`.

### Side effects

May emit a warning for ambiguous names.

### Failure modes

* Returns `null` when no matches exist.
* Returns `null` when multiple jobs share the same name.

### Example

```js
const job = AT.jobs.getByName("profile-card");
```

### Related methods

* [`listByName(name)`](./list-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/get-by-name.md ---



# --- begin: api/reference/at-jobs/get-id-by-element.md ---

# Method — `getIdByElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`getIdByElement(el)`](./get-id-by-element.md)

## `getIdByElement(el)`

### Signature

`getIdByElement(el) -> string|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Job id for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no mapping exists.

### Example

```js
const id = AT.jobs.getIdByElement(el);
```

### Related methods

* [`getByElement(el)`](./get-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/get-id-by-element.md ---



# --- begin: api/reference/at-jobs/has-element.md ---

# Method — `hasElement(el)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`hasElement(el)`](./has-element.md)

## `hasElement(el)`

### Signature

`hasElement(el) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element to test. |

### Returns

`true` when the element is already bound to a registered job.

### Side effects

None.

### Failure modes

Returns `false` when the element is not registered.

### Example

```js
if (AT.jobs.hasElement(el)) return;
```

### Related methods

* [`getIdByElement(el)`](./get-id-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/has-element.md ---



# --- begin: api/reference/at-jobs/INDEX.md ---

# Deep Reference — `AT.jobs`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/job/Registry.js](../../../../src/class/job/Registry.js)

---

## Method Pages

* [`resolve(x)`](./resolve.md)
* [`nextId()`](./next-id.md)
* [`hasElement(el)`](./has-element.md)
* [`getIdByElement(el)`](./get-id-by-element.md)
* [`getById(id)`](./get-by-id.md)
* [`getByElement(el)`](./get-by-element.md)
* [`getByName(name)`](./get-by-name.md)
* [`list()`](./list.md)
* [`listByStatus(status)`](./list-by-status.md)
* [`listByName(name)`](./list-by-name.md)
* [`register(job)`](./register.md)
* [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/INDEX.md ---



# --- begin: api/reference/at-jobs/list-by-name.md ---

# Method — `listByName(name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`listByName(name)`](./list-by-name.md)

## `listByName(name)`

### Signature

`listByName(name) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical name bucket in `byName`. |

### Returns

All jobs currently indexed under that name.

### Side effects

None.

### Failure modes

Returns `[]` when name is empty or has no indexed ids.

### Example

```js
const cards = AT.jobs.listByName("profile-card");
```

### Related methods

* [`getByName(name)`](./get-by-name.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/list-by-name.md ---



# --- begin: api/reference/at-jobs/list-by-status.md ---

# Method — `listByStatus(status)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`listByStatus(status)`](./list-by-status.md)

## `listByStatus(status)`

### Signature

`listByStatus(status) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | Yes | Exact `job.status` value to match (`===`). |

### Returns

Array of jobs whose status exactly matches.

### Side effects

None.

### Failure modes

Returns `[]` when no jobs match.

### Example

```js
const running = AT.jobs.listByStatus("running");
```

### Related methods

* [`list()`](./list.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/list-by-status.md ---



# --- begin: api/reference/at-jobs/list.md ---

# Method — `list()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`list()`](./list.md)

## `list()`

### Signature

`list() -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Returns all registered jobs. |

### Returns

Snapshot array of all jobs (Map insertion order).

### Side effects

None.

### Failure modes

Returns an empty array when registry is empty.

### Example

```js
for (const job of AT.jobs.list()) {
  // inspect each registered job
}
```

### Related methods

* [`listByStatus(status)`](./list-by-status.md)
* [`listByName(name)`](./list-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/list.md ---



# --- begin: api/reference/at-jobs/next-id.md ---

# Method — `nextId()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`nextId()`](./next-id.md)

## `nextId()`

### Signature

`nextId() -> string`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Generates the next registry id. |

### Returns

A new id in `${prefix}-${counter}` format.

### Side effects

Increments the internal id counter.

### Failure modes

None.

### Example

```js
const id = AT.jobs.nextId();
```

### Related methods

* [`register(job)`](./register.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/next-id.md ---



# --- begin: api/reference/at-jobs/register.md ---

# Method — `register(job)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`register(job)`](./register.md)

## `register(job)`

### Signature

`register(job) -> Job`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Job instance with a DOM element (`job.e`). |

### Returns

Registered job. If the element is already registered, returns the existing job.

### Side effects

* Assigns identity with `job.setIdentity({ id, createdAt })`.
* Updates `byId`, `byEl`, `createdAt`, and optional `byName` indexes.

### Failure modes

* Throws if `job` or `job.e` is missing.
* Throws on id collision with another registered job.

### Example

```js
const registered = AT.jobs.register(job);
```

### Related methods

* [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)
* [`setName(job, name)`](./set-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/register.md ---



# --- begin: api/reference/at-jobs/resolve.md ---

# Method — `resolve(x)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`resolve(x)`](./resolve.md)

## `resolve(x)`

### Signature

`resolve(x) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `x` | `any` | Yes | Job-like reference (id/name string, element, job-like object). |

### Returns

Resolved `Job` or `null`.

### Side effects

None.

### Failure modes

* Returns `null` for unknown or unsupported references.
* Ambiguous name lookup returns `null`.

### Example

```js
const job = AT.jobs.resolve(ref);
if (!job) return;
```

### Related methods

* [`toJob(ref)`](../at/to-job.md)
* [`getById(id)`](./get-by-id.md)
* [`getByElement(el)`](./get-by-element.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/resolve.md ---



# --- begin: api/reference/at-jobs/set-name.md ---

# Method — `setName(job, name)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`setName(job, name)`](./set-name.md)

## `setName(job, name)`

### Signature

`setName(job, name) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Registered job instance. |
| `name` | `string|null` | Yes | New logical name. Falsy values clear name indexing. |

### Returns

No return value.

### Side effects

* Removes prior name index entry (if any).
* Calls `job.setName(name)`.
* Adds the new name index entry when name is truthy.

### Failure modes

No-op when `job` or `job.id` is missing.

### Example

```js
AT.jobs.setName(job, "profile-card");
```

### Related methods

* [`listByName(name)`](./list-by-name.md)
* [`getByName(name)`](./get-by-name.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/set-name.md ---



# --- begin: api/reference/at-jobs/unregister.md ---

# Method — `unregister(jobOrIdOrEl, opts?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md) -> [`unregister(jobOrIdOrEl, opts?)`](./unregister.md)

## `unregister(jobOrIdOrEl, opts?)`

### Signature

`unregister(jobOrIdOrEl, opts?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobOrIdOrEl` | `Job|string|number|Element|Object` | Yes | Target job reference to remove. |
| `opts` | `Object` | No | Optional options. |
| `opts.reason` | `string` | No | Reason passed into `job.shutdown()` and shutdown log metadata. |

### Returns

`true` when a job was resolved and removed; otherwise `false`.

### Side effects

* Calls `job.shutdown({ reason })` before index removal.
* Records shutdown metadata.
* Removes all id/element/name/createdAt indexes for the job.

### Failure modes

* No-op with `false` when the target cannot be resolved.
* Propagates exceptions thrown by `job.shutdown(...)`.

### Example

```js
AT.jobs.unregister(el, { reason: "dom removed" });
```

### Related methods

* [`register(job)`](./register.md)
* [`resolve(x)`](./resolve.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-jobs/unregister.md ---



# --- begin: api/reference/at-observer/INDEX.md ---

# Deep Reference — `AT.observer`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/observer/Controller.js](../../../../src/class/observer/Controller.js)

---

## Method Pages

* [`start()`](./start.md)
* [`stop()`](./stop.md)
* [`setSelectors(selectorSpecs)`](./set-selectors.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-observer/INDEX.md ---



# --- begin: api/reference/at-observer/set-selectors.md ---

# Method — `setSelectors(selectorSpecs)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`setSelectors(selectorSpecs)`](./set-selectors.md)

## `setSelectors(selectorSpecs)`

### Signature

`setSelectors(selectorSpecs) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `selectorSpecs` | `any` | Yes | Prebuilt selector spec(s) expected by the observer service. |

### Returns

No return value.

### Side effects

* Stores provided value in `_selectorSpecs`.
* Forwards value directly to `observer.setSelectors(...)`.

### Failure modes

* No-op when observer service is missing.
* Invalid selector spec shapes may fail later in the observer service.

### Example

```js
AT.observer.setSelectors([
  {
    selector: "[at]",
    includeSubtreeMatches: true,
    observeAttributes: true,
    attributeFilter: ["at"],
    onEvent: (batch) => console.log(batch)
  }
]);
```

### Related methods

* [`start()`](./start.md)
* [`stop()`](./stop.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-observer/set-selectors.md ---



# --- begin: api/reference/at-observer/start.md ---

# Method — `start()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`start()`](./start.md)

## `start()`

### Signature

`start() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Uses compiled config to derive selector specs. |

### Returns

No return value.

### Side effects

* Reads observation policy from `conf.observe` and fallback selector from `conf.boot.selector`.
* Builds selector specs and stores them in `_selectorSpecs`.
* Calls `observer.setSelectors(selectorSpecs)` and `observer.start()`.
* Wires callbacks to `_onDomChanges(batch)`.

### Failure modes

* Throws if observer service is missing.
* Throws if runtime document is missing/invalid.
* Throws when resolved selector list is empty.
* Throws when attribute observation is enabled but attribute filter list is empty.

### Example

```js
AT.observer.start();
```

### Related methods

* [`stop()`](./stop.md)
* [`setSelectors(selectorSpecs)`](./set-selectors.md)
* [`AT.discover.registerJobs(...)`](../at-discover/register-jobs.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-observer/start.md ---



# --- begin: api/reference/at-observer/stop.md ---

# Method — `stop()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`stop()`](./stop.md)

## `stop()`

### Signature

`stop() -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Stops observation on the injected observer service. |

### Returns

No return value.

### Side effects

Calls `observer.stop()` when observer exists.

### Failure modes

No-op when observer service is unavailable.

### Example

```js
AT.observer.stop();
```

### Related methods

* [`start()`](./start.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at-observer/stop.md ---



# --- begin: api/reference/AT.md ---

# Reference — Top-Level `AT`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for top-level `AT` methods.

## Deep reference

* [Top-level `AT` deep reference](./at/INDEX.md)

## Methods

* [`start()`](./at/start.md)
* [`enqueueAll(reason?)`](./at/enqueue-all.md)
* [`toJob(ref)`](./at/to-job.md)

---

## See also

* [`AT.jobs`](./AT_JOBS.md)
* [`AT.engine`](./AT_ENGINE.md)
* [Reference Manual index](./INDEX.md)


# --- end: api/reference/AT.md ---



# --- begin: api/reference/at/enqueue-all.md ---

# Method — `enqueueAll(reason?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`enqueueAll(reason?)`](./enqueue-all.md)

## `enqueueAll(reason?)`

### Signature

`enqueueAll(reason?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | Diagnostic reason attached to enqueue inputs. Defaults to `"none given"` when empty. |

### Returns

Number of enqueue attempts issued across all eligible jobs and autorun pipeline keys.

### Side effects

* Iterates over `AT.jobs.list()`.
* For eligible jobs (`enabled !== false` and non-empty `autorun` list), calls `AT.engine.enqueue(job, key, opts)`.
* Normalizes `"__DEFAULT__"` autorun entries to `"default"`.
* Writes enqueue return values to console (`console.log`).

### Failure modes

* No-op for jobs that are disabled or have no autorun pipelines.
* Propagates exceptions from `AT.engine.enqueue(...)` if enqueue fails.

### Example

```js
// Enqueue all autorun pipelines discovered so far.
const count = AT.enqueueAll("boot");
```

### Related methods

* [`AT.engine.enqueue()`](../at-engine/enqueue.md)
* [`AT.jobs.list()`](../at-jobs/list.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at/enqueue-all.md ---



# --- begin: api/reference/at/INDEX.md ---

# Deep Reference — Top-Level `AT`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/ActiveTags.js](../../../../src/ActiveTags.js)
* [../../../../src/traits/engine.js](../../../../src/traits/engine.js)
* [../../../../src/traits/job.js](../../../../src/traits/job.js)

---

## Method Pages

* [`start()`](./start.md)
* [`enqueueAll(reason?)`](./enqueue-all.md)
* [`toJob(ref)`](./to-job.md)

---

## See also

* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at/INDEX.md ---



# --- begin: api/reference/at/start.md ---

# Method — `start()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`start()`](./start.md)

## `start()`

### Signature

`start() -> Promise<void>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | `start()` takes no arguments. |

### Returns

Resolves when boot-time activation is complete: initial discover scan, optional observer start, interval/event registration, and optional interval/event activation.

### Side effects

* Reads `lib._env.root.document` and validates `document.body`.
* Calls `AT.discover.scan()`.
* May call `AT.observer.start()` when `conf.boot.observeDom` is enabled.
* Calls `AT.intervals.registerAll()` and `AT.events.registerAll()`.
* May call `AT.intervals.on()` and `AT.events.on()` based on boot flags.

### Failure modes

* Throws if `document` or `document.body` is missing.
* Propagates errors from discover/observer/events/intervals subsystems.

### Example

```js
const AT = new ActiveTags(lib, conf);
await AT.start();
```

### Related methods

* [`AT.discover.scan()`](../at-discover/scan.md)
* [`AT.observer.start()`](../at-observer/start.md)
* [`AT.events.registerAll()`](../at-events/register-all.md)
* [`AT.intervals.registerAll()`](../at-intervals/register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at/start.md ---



# --- begin: api/reference/at/to-job.md ---

# Method — `toJob(ref)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`toJob(ref)`](./to-job.md)

## `toJob(ref)`

### Signature

`toJob(ref) -> Job|undefined`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ref` | `any` | Yes | Job-like reference forwarded to the job registry resolver. |

### Returns

Resolved `Job` instance when found; otherwise `undefined`.

### Side effects

None. This is a pure resolver wrapper over `AT.jobs.resolve(...)`.

### Failure modes

* Returns `undefined` when resolution fails.
* Does not throw for unresolved references.

### Example

```js
const job = AT.toJob("DEFAULT__at-3");
if (!job) return;
```

### Related methods

* [`AT.jobs.resolve()`](../at-jobs/resolve.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)


# --- end: api/reference/at/to-job.md ---



# --- begin: api/reference/INDEX.md ---

# API Reference Manual — ActiveTags

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This section is the method-level reference for callable runtime surfaces.

## Object surfaces

1. [Top-level `AT` instance](./AT.md)
2. [`AT.jobs` registry](./AT_JOBS.md)
3. [`AT.discover` controller](./AT_DISCOVER.md)
4. [`AT.observer` controller](./AT_OBSERVER.md)
5. [`AT.events` controller](./AT_EVENTS.md)
6. [`AT.intervals` controller](./AT_INTERVALS.md)
7. [`AT.engine` facade](./AT_ENGINE.md)

## Scope notes

* Methods beginning with `_` are internal and intentionally excluded.
* This manual documents callable behavior; implementation details remain in source.
* Method names and signatures are sourced from current runtime files.

---

## See also

* [API Index](../INDEX.md)
* [ActiveTags API Contract](../ACTIVE_TAGS_API_CONTRACT.md)
* [Usage TOC](../../usage/TOC.md)
* [Architecture Index](../../architecture/INDEX.md)
* [README](../../../README.md)


# --- end: api/reference/INDEX.md ---



# --- begin: architecture/INDEX.md ---

# Architecture Documentation — ActiveTags

[README](../../README.md) -> [Architecture Index](./INDEX.md) -> [Usage TOC](../usage/TOC.md) -> [API Index](../api/INDEX.md)


This section documents internal architecture and subsystem boundaries.

For implementation-level API references, see:

* **API Index** -> [../api/INDEX.md](../api/INDEX.md)
* **What Makes ActiveTags Different** -> [../WHAT_MAKES_US_DIFFERENT.md](../WHAT_MAKES_US_DIFFERENT.md)

For usage-first onboarding, see:

* **Usage TOC** -> [../usage/TOC.md](../usage/TOC.md)

---

## Core architecture

* **System Overview** -> [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
* **Subsystem Map** -> [SUBSYSTEMS.md](./SUBSYSTEMS.md)

---

## Subsystems

* **Config Schema** -> [subsystems/CONFIG_SCHEMA.md](./subsystems/CONFIG_SCHEMA.md)
* **Discover** -> [subsystems/DISCOVER.md](./subsystems/DISCOVER.md)
* **Jobs & Registry** -> [subsystems/JOB_AND_REGISTRY.md](./subsystems/JOB_AND_REGISTRY.md)
* **Engine & VM** -> [subsystems/ENGINE_AND_VM.md](./subsystems/ENGINE_AND_VM.md)
* **Event Controller** -> [subsystems/EVENTS.md](./subsystems/EVENTS.md)
* **Interval Controller** -> [subsystems/INTERVALS.md](./subsystems/INTERVALS.md)
* **Observer Controller** -> [subsystems/OBSERVER.md](./subsystems/OBSERVER.md)
* **Expression Resolver** -> [subsystems/EXPRESSION_RESOLVER.md](./subsystems/EXPRESSION_RESOLVER.md)
* **Builtins, Buffer, Target** -> [subsystems/BUILTINS_BUFFER_TARGET.md](./subsystems/BUILTINS_BUFFER_TARGET.md)

---

## Navigation

* Usage TOC -> [../usage/TOC.md](../usage/TOC.md)
* API Index -> [../api/INDEX.md](../api/INDEX.md)
* Project README -> [../../README.md](../../README.md)

---

## See also

* [System Overview](./SYSTEM_OVERVIEW.md)
* [Subsystem Map](./SUBSYSTEMS.md)
* [Usage TOC](../usage/TOC.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: architecture/INDEX.md ---



# --- begin: architecture/SUBSYSTEMS.md ---

# Subsystem Map — ActiveTags

[README](../../README.md) -> [Architecture Index](./INDEX.md)


This map aligns runtime subsystems to responsibilities.

---

## Orchestrator

* **ActiveTags class** -> [../../src/ActiveTags.js](../../src/ActiveTags.js)

Responsibilities:

* compose subsystems
* compile runtime config
* expose runtime lifecycle entry (`start()`)

---

## Config compilation

* Top-level schema -> [../../src/at_config/Schema.js](../../src/at_config/Schema.js)
* Per-job config -> [../../src/class/job/config/JobConfig.js](../../src/class/job/config/JobConfig.js)
* Job schema compiler -> [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

---

## Discovery and registry

* Discover controller -> [../../src/class/discover/Controller.js](../../src/class/discover/Controller.js)
* Job registry -> [../../src/class/job/Registry.js](../../src/class/job/Registry.js)
* Job model -> [../../src/class/job/Job.js](../../src/class/job/Job.js)

---

## Runtime execution

* Engine facade -> [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* Manager/policy -> [../../src/class/engine/EngineManager.js](../../src/class/engine/EngineManager.js)
* State -> [../../src/class/engine/EngineState.js](../../src/class/engine/EngineState.js)
* Tick driver -> [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* VM -> [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)

---

## Trigger controllers

* Events -> [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* Intervals -> [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* Observer -> [../../src/class/observer/Controller.js](../../src/class/observer/Controller.js)

---

## Expression and operations

* Expression resolver -> [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* Builtins root -> [../../src/builtins/index.js](../../src/builtins/index.js)


---

## See also

* [Architecture Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: architecture/SUBSYSTEMS.md ---



# --- begin: architecture/subsystems/BUILTINS_BUFFER_TARGET.md ---

# Subsystem — Builtins, Buffer, Target Conveyor

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Builtins are stage operations; buffer and target form explicit ticket-local conveyor channels.

---

## Builtins root

* [../../../src/builtins/index.js](../../../src/builtins/index.js)

Builtin families:

* form
* dom
* error
* buffer
* target
* http

---

## Buffer conveyor

Buffer enables explicit stage-to-stage data handoff:

* write payload/meta in one stage
* read/traverse in downstream stages

Reference: [../../../src/builtins/buffer/index.js](../../../src/builtins/buffer/index.js)

---

## Target conveyor

Target enables explicit DOM focus routing:

* set/reset target
* derive target from buffer or DOM relationships
* route DOM operations against current target

Reference: [../../../src/builtins/target/index.js](../../../src/builtins/target/index.js)

---

## Why this matters

This conveyor model reduces implicit state coupling and keeps complex workflows inspectable and deterministic.

---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/BUILTINS_BUFFER_TARGET.md ---



# --- begin: architecture/subsystems/CONFIG_SCHEMA.md ---

# Subsystem — Config Schema

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


This subsystem compiles runtime and job configuration into normalized, executable shapes.

---

## Components

### Top-level schema compiler

* [../../../src/at_config/Schema.js](../../../src/at_config/Schema.js)
* Defaults: [../../../src/at_config/DEFAULT_CONFIG.js](../../../src/at_config/DEFAULT_CONFIG.js)

Produces `AT.conf` used by runtime subsystems.

### Per-job config compiler

* [../../../src/class/job/config/JobConfig.js](../../../src/class/job/config/JobConfig.js)
* [../../../src/class/job/config/DomConfigSource.js](../../../src/class/job/config/DomConfigSource.js)
* [../../../src/class/job/config/schema/Master.js](../../../src/class/job/config/schema/Master.js)

Produces `job.config.schema` for event/interval/pipeline registration.

---

## Contract summary

* Compile first, execute later.
* Coercion + normalization preferred over implicit runtime guessing.
* Compiled outputs are runtime source of truth.

---

## Non-responsibilities

* No execution stepping
* No queue/scheduling control
* No direct DOM side-effects beyond config extraction

---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/CONFIG_SCHEMA.md ---



# --- begin: architecture/subsystems/DISCOVER.md ---

# Subsystem — Discover

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Discover bridges DOM candidates into registered Job instances.

---

## Component

* [../../../src/class/discover/Controller.js](../../../src/class/discover/Controller.js)

---

## Responsibilities

* Sweep DOM by selector(s)
* De-duplicate candidate elements
* Create Job instances for new elements
* Register jobs into JobRegistry
* Trigger initial per-job config compile

---

## Behavioral posture

* Re-runnable and idempotent per element identity
* Execution-agnostic (does not run pipelines)
* Registry-facing, not engine-facing

---

## Inputs

* selector from call argument or boot config
* runtime job config policy
* expression resolver and environment


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/DISCOVER.md ---



# --- begin: architecture/subsystems/ENGINE_AND_VM.md ---

# Subsystem — Engine & VM

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


The deterministic execution spine of ActiveTags.

---

## Components

* Engine facade -> [../../../src/class/engine/Engine.js](../../../src/class/engine/Engine.js)
* State store -> [../../../src/class/engine/EngineState.js](../../../src/class/engine/EngineState.js)
* Manager/policy -> [../../../src/class/engine/EngineManager.js](../../../src/class/engine/EngineManager.js)
* Tick driver -> [../../../src/class/engine/Tick.js](../../../src/class/engine/Tick.js)
* VM stepper -> [../../../src/class/engine/vm/VM.js](../../../src/class/engine/vm/VM.js)
* VM helpers/status -> [../../../src/class/engine/helpers.js](../../../src/class/engine/helpers.js)

---

## Ticket model

Tickets represent one execution request for `(jobId, pipelineKey)`.

Ticket-local state includes:

* stage cursor
* buffer
* target
* inputs
* lifecycle status

---

## Execution contract

* `enqueue(...)` prepares ticket
* `tick(...)` performs one stage transition
* `drain(...)` loops tick with bounds
* VM normalizes stage responses into explicit status categories

---

## Error posture

Errors are normalized into stage responses and routed through error-phase semantics when configured.


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/ENGINE_AND_VM.md ---



# --- begin: architecture/subsystems/EVENTS.md ---

# Subsystem — Event Controller

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Event controller maps job event schema into delegated DOM handlers.

---

## Component

* [../../../src/class/event/Controller.js](../../../src/class/event/Controller.js)

---

## Responsibilities

* register event definitions from job schema
* install/uninstall delegated handlers through service
* enable/disable per-event runtime state
* enqueue pipelines on event trigger

---

## Service dependency

Uses `primitive.dom.eventdelegator` service.

Related vendor contract:

* [../../vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md](../../vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md)

---

## Non-responsibilities

* does not execute pipelines directly
* does not own scheduler policy


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/EVENTS.md ---



# --- begin: architecture/subsystems/EXPRESSION_RESOLVER.md ---

# Subsystem — Expression Resolver

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Expression resolver provides target parsing/evaluation for runtime interpolation and stage argument materialization.

---

## Component

* [../../../src/class/expressions/ExpressionResolver.js](../../../src/class/expressions/ExpressionResolver.js)
* Dispatch helpers -> [../../../src/class/expressions/dispatch.js](../../../src/class/expressions/dispatch.js)
* Interpolator -> [../../../src/class/expressions/Interpolator.js](../../../src/class/expressions/Interpolator.js)

---

## Responsibilities

* parse `type:locator` target expressions
* evaluate parsed references against runtime context (`job`, `ticket`, `buffer`, DOM)
* provide interpolation and materialization helpers used by VM

---

## Notes

* current runtime file is `ExpressionResolver.js`
* legacy `ExpressionResolver.098.js` is inactive/reference-only


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/EXPRESSION_RESOLVER.md ---



# --- begin: architecture/subsystems/INTERVALS.md ---

# Subsystem — Interval Controller

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Interval controller maps job interval schema into managed timer registrations.

---

## Component

* [../../../src/class/interval/Controller.js](../../../src/class/interval/Controller.js)

---

## Responsibilities

* register interval definitions from job schema
* start/stop interval runtime state
* enqueue pipelines on interval ticks
* track interval entry state by job

---

## Service dependency

Uses `primitive.interval` service.

Related vendor contract:

* [../../vendor_api_contracts/INTERVAL_API_CONTRACT.md](../../vendor_api_contracts/INTERVAL_API_CONTRACT.md)

---

## Non-responsibilities

* does not execute pipeline stages
* does not manage VM stepping


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/INTERVALS.md ---



# --- begin: architecture/subsystems/JOB_AND_REGISTRY.md ---

# Subsystem — Jobs & Registry

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


This subsystem owns job identity, lookup, and lifecycle anchoring.

---

## Components

* Job model -> [../../../src/class/job/Job.js](../../../src/class/job/Job.js)
* Registry -> [../../../src/class/job/Registry.js](../../../src/class/job/Registry.js)

---

## Responsibilities

### Job

* stable identity metadata
* DOM anchor (`job.e`)
* runtime flags/status
* delegated config compiler (`job.config`)

### Registry

* id generation
* indexes by id/element/name
* reference resolution (`resolve(...)`)
* controlled unregister/shutdown coordination

---

## Why this matters

Execution and triggers depend on deterministic job identity; registry is the canonical lookup boundary.


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/JOB_AND_REGISTRY.md ---



# --- begin: architecture/subsystems/OBSERVER.md ---

# Subsystem — Observer Controller

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Observer controller translates DOM mutation batches into discover/register/unregister signals.

---

## Component

* [../../../src/class/observer/Controller.js](../../../src/class/observer/Controller.js)

---

## Responsibilities

* apply observer selector policy from runtime config
* start/stop observation against shared service
* translate mutation batch buckets into discover/remove operations

---

## Service dependency

Uses `primitive.dom.changeobserver` service.

Related vendor contract:

* [../../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](../../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)

---

## Runtime boundary

Observer is reporting/translation layer; it does not execute pipelines directly.


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)


# --- end: architecture/subsystems/OBSERVER.md ---



# --- begin: architecture/SYSTEM_OVERVIEW.md ---

# System Overview — ActiveTags

[README](../../README.md) -> [Architecture Index](./INDEX.md)


ActiveTags is a deterministic runtime for DOM-declared workflows.

---

## Top-level composition

`ActiveTags` orchestrates:

* top-level config compile
* job registry
* expression resolver
* engine runtime
* trigger controllers (discover/event/interval/observer)

Entry point:

* [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## Runtime flow

1. Compile runtime config (`AT.conf`)
2. Discover active DOM elements and register jobs
3. Compile per-job schema
4. Register trigger definitions (events/intervals)
5. Enqueue tickets on trigger activity
6. Execute through Engine -> Tick -> VM

---

## Design boundaries

### ActiveTags (orchestrator)

Owns composition and lifecycle gates (`start()`).

### Controllers (trigger/attachment layer)

Discover, Event, Interval, Observer convert DOM/time signals into enqueue requests.

### Engine (execution layer)

Owns ticket lifecycle, stage stepping, and error transitions.

### Builtins (operation layer)

Provide standardized side-effect operations in pipeline stages.

---

## Determinism posture

The runtime centers around explicit status transitions and ticket-local state:

* `ready`
* `running`
* `wait`
* `error`
* `complete`

Reference constants/helpers:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)


---

## See also

* [Architecture Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: architecture/SYSTEM_OVERVIEW.md ---



# --- begin: TODO.md ---

# Documentation TODO Checklist

- [ ] Setting up pipelines (dedicated page)
- [ ] Setting up intervals (dedicated page)
- [ ] Setting up events (dedicated page)
- [ ] Setting up requests (dedicated page)
- [ ] How to use `require`
- [ ] How to use builtins
- [ ] `autorun` and `enable`
- [ ] Pipeline handlers (user code)
- [ ] Event hooks for the engine
- [ ] Reviewing logs


# --- end: TODO.md ---



# --- begin: usage/BASIC_TAG_SETUP.md ---

# Basic Tag Setup — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page explains how to set up a single ActiveTag element and where its config can come from.
Primary reference example: [../../examples/test1.html](../../examples/test1.html)

`examples/test1.html` includes some legacy/iterative inline attributes. They are still useful for understanding setup patterns and source references.

---

## 1) Mark an element as an ActiveTag

At minimum:

```html
<div data-activetag></div>
```

Default selector is `[data-activetag]`.

Runtime flow:

1. `AT.start()` runs an initial `discover.scan()` pass for existing matching elements.
2. If `boot.observeDom` is enabled, the observer starts and handles later DOM mutations.
3. Added/changed matching nodes are registered; removed/change-away nodes are unregistered.

Practical note: page-load tags are discovered by the boot scan path, while the observer path is mainly for post-start DOM changes.

---

## 2) Attribute naming: `data-*` and `at-*`

Per-job DOM config reads both prefixes by default:

* `data-*`
* `at-*`

So these are equivalent config pointer styles:

* `data-config-at="..."`
* `at-config-at="..."`

And these are equivalent short pointer styles:

* `data-at="..."`
* `at-at="..."`

Why this works:

* Prefixes come from `AT.conf.job.config.attrPrefixes` (default: `["data-", "at-"]`).
* Attribute keys are inflated by `-` into nested config paths.

Example:

* `data-request-timeout-ms="8000"` becomes `request.timeout.ms`.

---

## 3) Disabling inline attributes during iteration

In `examples/test1.html`, some attributes are intentionally disabled during iteration by prefixing a leading `d` on the attribute name, for example:

```html
<div
  data-activetag
  data-at="import:jumjum.import.js"
  ddata-at="find:.config"
  ddata-at="window:ws.conf.jumjum">
</div>
```

`ddata-*` (or similar) is not a recognized ActiveTags prefix, so it is ignored by config extraction.
This is just an iteration/debug convention to keep alternate references in place without deleting them.

---

## 4) Config source pointers (`config.at` / `at`)

ActiveTags reads config source pointer values from these paths by default:

1. `config.at`
2. `at`

That maps to attributes like:

* `data-config-at` / `at-config-at`
* `data-at` / `at-at`

Each pointer value can contain one or more source tokens.
Tokens are resolved left-to-right and merged in order (later tokens override earlier ones).
This token parsing path is implemented in [../../src/class/job/config/DomConfigSource.js](../../src/class/job/config/DomConfigSource.js).
Expression target syntax details are documented in [v098 DSL Manual](./DSL_V098.md).

---

## 5) Supported source types

### A) Inline DOM lookup: `find:...`

Example:

```html
<div data-activetag data-config-at="find:.config">
  <script class="config" type="application/json">
    { "name": "demo-job" }
  </script>
</div>
```

`find:.config` resolves relative to the active tag element and can return a DOM node containing config payload.

### B) Environment object lookup: `window:...`

Example:

```html
<div data-activetag data-config-at="window:ws.config.demo"></div>
```

This resolves from the runtime window/root context through the expression resolver.

### C) Module import: `import:...`

Example:

```html
<div data-activetag data-config-at="import:test-job.js"></div>
```

`import:<url>` and `import:<url>#<namedExport>` are supported.
Imports are policy-gated by:

* `job.config.importEnabled`
* `job.config.importPath` allow-list rules

Performance note:

* Import-based config resolution is awaited during job config read/compile.
* If many tags each import config, startup/configuration time can increase.
* For large setups, prefer importing once outside ActiveTags boot and then reference the in-memory object via `window:...` (or equivalent environment path).

See setup example in [../../examples/test1.html](../../examples/test1.html), where import support is explicitly enabled.

### D) DOM node `src` fallback

If a resolved DOM config node has no inline text, ActiveTags will attempt to read `data-src` or `src` and fetch text from there.
This is useful for script-tag style config containers.
For JSON script nodes in particular, this allows config loading even when the browser itself is not executing that script payload.

---

## 6) Layering multiple config sources

You can chain multiple sources in one attribute:

```html
<div
  data-activetag
  data-config-at="window:ws.config.base window:ws.config.testJob import:test-job.js"
  data-name="job-from-inline">
</div>
```

Merge order:

1. Base/default job config
2. Resolved source list (`config.at` / `at`) left-to-right
3. Inline DOM dataset (`data-*`/`at-*`) last

So inline keys are final overrides when the same field appears in multiple layers.

---

## 7) Backend composition options

This setup model supports different server/build patterns:

* Keep config inline with HTML modules/components.
* Keep shared config on globals (`window:...`).
* Load config modules (`import:...`) from local or allowed external paths.
* Layer base + variant sources per tag (for example: `window:ws.config.base window:ws.config.testJob`).

This makes ActiveTags workable across mixed construction styles (for example, PHP-rendered markup, remote config modules, or centrally stored config maps).

---

## 8) Minimal startup policy for basic tag experiments

From [../../examples/test1.html](../../examples/test1.html), these runtime options are relevant for config-source behavior:

```js
const AT = new ActiveTags(lib, {
  boot: {
    observeDom: true,
    events: true,
    intervals: false,
  },
  job: {
    config: {
      evalEnabled: true,
      evalType: "text/at-eval",
      importEnabled: true,
      importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
    },
  },
});
```

Use `new ActiveTags(lib, conf)` with a valid `lib` instance. A global `window.lib` is optional and not required by contract.

---

## 9) Debugging config-read failures quickly

If an external config reference fails (for example bad `find:`, `window:`, or `import:` target), the job still has DOM-derived attributes available.
So in failure cases you often still get inline dataset config, but not the expected external config object.

A practical debugging pattern is to always set a name in DOM attributes:

```html
<div at-name="test-link" at-config-at="xyz"></div>
```

Then inspect directly:

```js
const job = AT.toJob("test-link");
```

Useful report surfaces:

* `job.config.inputs`:
  DOM read snapshot (`dataSet`, `attrs`, resolved `at` list, resolved `config`, merged `output`).
* `job.config.inputs.report`:
  source-read/resolve/parse diagnostics (common place for config source errors).
* `job.config.schemaReport`:
  schema compile/normalization diagnostics (shape/format/data-structure issues after inputs are read).

This split helps you quickly decide if the issue is:

1. Source resolution/loading/parsing (`inputs.report`)
2. Schema structure/typing (`schemaReport`)

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Configuration Model](./CONFIGURATION.md)
* [v098 DSL Manual](./DSL_V098.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [../../examples/test1.html](../../examples/test1.html)
* [../../src/class/job/config/DomConfigSource.js](../../src/class/job/config/DomConfigSource.js)
* [Usage TOC](./TOC.md)
* [README](../../README.md)


# --- end: usage/BASIC_TAG_SETUP.md ---



# --- begin: usage/CONFIGURATION.md ---

# Configuration Model — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags uses two configuration layers.

---

## Layer 1: Runtime config (`AT.conf`)

Compiled by top-level schema compiler:

* [../../src/at_config/Schema.js](../../src/at_config/Schema.js)
* Baseline defaults: [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)

This layer controls runtime policy, including:

* environment
* boot behavior
* observer behavior
* logging policy
* engine hooks/builtins
* job config policy defaults

---

## Layer 2: Per-job config (`job.config.schema`)

Compiled per discovered element through:

* [../../src/class/job/config/JobConfig.js](../../src/class/job/config/JobConfig.js)
* [../../src/class/job/config/DomConfigSource.js](../../src/class/job/config/DomConfigSource.js)
* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

This layer produces normalized job-level schema blocks (pipelines, events, intervals, requests).

---

## Merge posture

Top-level and per-job compilation both follow coercion/normalization-first posture:

* normalize shape
* compile deterministic output
* preserve warnings/errors in report objects

---

## Config sources in practice

For job config, effective input can include:

* default base policy from runtime config
* DOM data attributes
* config references (`data-config-at`/`at` path)
* optional eval/import paths (policy gated)

See repository example: [../../examples/test-job.js](../../examples/test-job.js)

---

## Key takeaway

Treat compiled outputs as source of truth:

* `AT.conf` for runtime behavior
* `job.config.schema` for job behavior

Avoid reading uncompiled raw inputs for runtime decisions.

---

## Related

* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Architecture -> [../architecture/INDEX.md](../architecture/INDEX.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/CONFIGURATION.md ---



# --- begin: usage/DSL_V098.md ---

# v098 DSL Manual — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This manual documents the v098 expression DSL profile used by ActiveTags expression parsing/evaluation.

Primary sources:

* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)

---

## Version note

The resolver internals are expected to evolve in later releases.
The v098 DSL profile is intended to remain supported, and a resolver-version flag is planned so you can explicitly select the DSL/resolver version when newer profiles are introduced.

Current status:

* runtime source of truth is `ExpressionResolver.js`
* `ExpressionResolver.098.js` is legacy/inactive reference material

---

## 1) Core expression form

Expressions are parsed as:

```txt
type:locator
```

Examples:

* `job:id`
* `config:name`
* `this:innerHTML`
* `target:value`
* `window:location.href`
* `find:.title`
* `doc:#my-id`

Parsing/evaluation model:

1. `parse(ctx, target)` resolves the expression into either:
   * a target reference object: `{ src, prop }`
   * a direct value
   * a DOM element
   * `undefined`
2. `eval(ctx, target)` returns the final value (property lookup for `{ src, prop }`).

Unknown target types resolve to `undefined` unless provided by context override (see section 4).

---

## 2) Dispatch targets (v098 profile)

The dispatch table is defined in [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js).

### Runtime/object targets

* `job:<path>`
  resolves from the current Job object
* `ticket:<path>`
  resolves from the current ticket
* `config:<path>`
  resolves from `job.config.schema`
* `trans:<path>`
  resolves from `job.transactions`
* `ws:<path>`
  resolves from `job.ws`
* `buffer:<path>`
  resolves from `ticket.buffer.get()`
* `buffer_meta:<path>`
  resolves from `ticket.buffer.meta()`
* `window:<path>`
  resolves from runtime window/root

### DOM-anchor targets

* `this:<path>`
  resolves from `job.e`
* `target:<path>`
  resolves from `ticket.target`

### DOM query targets

* `doc:<selector>`
  uses `document.querySelector(selector)`
* `find:<selector>`
  uses `(ticket.target || job.e).querySelector(selector)` with base-match fallback
* `closest:<selector>`
  uses `(ticket.target || job.e).closest(selector)`

### Form target

* `form:<fieldName>`
  uses `lib.site.form.collect(base)` and returns the matching parameter value

### Legacy compatibility target

* `inline:<anything>`
  returns `{ src: job.e, prop: "innerHTML", special: <locator> }`

---

## 3) Locator semantics

`locator` is passed through as a string and interpreted by the target handler.

Common behaviors:

* For `{ src, prop }` references, property lookup uses:
  * `lib.dom.get(src, prop)` when `src` is a DOM element
  * `lib.hash.get(src, prop)` otherwise
* For selector-based targets (`doc`, `find`, `closest`), locator is a CSS selector.

When selector queries fail or return no match, resolver returns `undefined` and may emit warnings through the configured logger.

---

## 4) Context override behavior

If a `type` is not in built-in dispatch and `ctx[type]` exists:

* if `ctx[type]` is a function, resolver calls it with `(locator)`
* otherwise resolver treats it as `{ src: ctx[type], prop: locator }`

This allows local extension of expression targets without changing core dispatch.

---

## 5) Interpolation form (`${...}`)

`Interpolator` supports deep parsing/materialization of `${...}` tokens.

Two modes:

* value expression:
  * `"${job:id}"` returns raw resolved value type
* template expression:
  * `"id=${job:id}"` returns a string after interpolation

Materialization helper:

* `materialize(ctx, value)` parses and evaluates `${...}` recursively through objects/arrays/strings.

---

## 6) v098 op-list shorthand

ExpressionResolver also provides a v098-style list parser for compact op strings:

* `"op"` -> `{ op: "op", args: [], raw: "op" }`
* `"op:a,b,c"` -> `{ op: "op", args: ["a", "b", "c"], raw: "op:a,b,c" }`

Object items pass through unchanged.
This is tokenization/normalization only; it does not execute operations.

---

## 7) Practical debugging

For DOM-bound jobs, define a name so inspection is direct:

```html
<div at-name="test-link" at-config-at="window:ws.config.testLink"></div>
```

Then inspect:

```js
const job = AT.toJob("test-link");
```

Useful pointers:

* `job.config.inputs.report`:
  source resolution/read/parse errors
* `job.config.schemaReport`:
  schema normalization/shape errors

---

## See also

* [Basic Tag Setup](./BASIC_TAG_SETUP.md)
* [Configuration Model](./CONFIGURATION.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)
* [Usage TOC](./TOC.md)
* [README](../../README.md)


# --- end: usage/DSL_V098.md ---



# --- begin: usage/EXAMPLES_LIBRARY.md ---

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

## Usage note

Some files in `examples/` are iterative or backup variants (`~` suffix). Use the non-suffixed files as current references.

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/EXAMPLES_LIBRARY.md ---



# --- begin: usage/INSTALLATION.md ---

# Installation & Dependencies — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags is a browser-oriented runtime module.

For canonical dependency/version requirements, see:

* [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## Required runtime surface

ActiveTags requires:

1. A valid m7 `lib` instance (import, DI container, or any stored variable)
2. Core utility dependencies:
   * `hash`
   * `primitive.workspace`
   * `dom`
   * `str.interp`
3. Core services:
   * `primitive.dom.eventdelegator`
   * `primitive.interval`
   * `primitive.dom.changeobserver`
   * `primitive.log`

Service keys are defined in: [../../src/constants.js](../../src/constants.js)

---

## Module entry choices

### Primary runtime class

```js
import ActiveTags from "../../src/ActiveTags.js";
```

### Auto-registration entry

```js
import "../../src/auto.js";
```

`auto.js` registers `ActiveTags` at `lib.site.activeTags`.

---

## Example dependency boot sequence

Reference implementation:

* [../../examples/test1.html](../../examples/test1.html)

This file demonstrates loading supporting m7 modules before creating `ActiveTags`.

---

## Environment assumptions

* Modern browser with ES module support
* DOM available (`document`, `MutationObserver` via observer service)
* Services pre-registered in `lib` before runtime construction

---

## Verification checklist

Before calling `new ActiveTags(...)`, verify:

* a valid `lib` instance is available in scope for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` can resolve dependencies
* `lib.require.service(...)` returns all required services

If any dependency is missing, constructor/startup will throw.

---

## Related

* Quick start -> [QUICKSTART.md](./QUICKSTART.md)
* Troubleshooting -> [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/INSTALLATION.md ---



# --- begin: usage/INTRODUCTION.md ---

# Introduction — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

> **Version notice**
> ActiveTags 1.0 is the spiritual successor to prior versions. It shares core ideas, but the runtime/process model has been substantially streamlined and is not backward compatible at this time.
> ActiveTags 0.99 and lower differ substantially from the current model.

ActiveTags exists to close a common gap: HTML and JavaScript often do not compose cleanly at scale.

For simple behavior, inline attributes can be enough. Example:

```html
<a
  at-pipeline="http.get:/foo/bar buffer.out:innerHtml"
  at-event-event="click"
  at-event-pipeline="default">
  About
</a>
```

That works well for local behavior. At scale, inline-only config becomes limiting:

* behavior becomes harder to maintain when configuration is scattered across markup
* complex actions become hard to express as short attribute strings
* teams often need reusable, centrally managed component behavior

ActiveTags supports both inline and external configuration so teams can choose the right control surface per component.

Example with external config reference:

```html
<a at-name="link-about" at-config-at="window:ws.links.about">About</a>
```

With external config, behavior can live in structured objects and be managed separately from templates. This keeps markup cleaner while still supporting expressive workflows.

Inline and external configuration can be mixed as needed. Inline attributes take priority when both are present.

## Why this matters

Without a unified runtime, advanced behavior usually becomes scattered event handlers and custom glue for retries, fallbacks, refreshes, and post-action logic.

ActiveTags replaces that pattern with declarative pipelines: define `run x -> y -> z` once and let the runtime orchestrate execution consistently across components.

## How it works

ActiveTags behaves like an assembly line:

1. A stage receives the current work product.
2. It transforms or validates that work.
3. It passes the result to the next stage.

At runtime, this model centers on two conveyor concepts:

* `buffer`: the current work product moving through the pipeline
* `target`: the current DOM focus where that work is applied

This makes each stage explicit: what it received, what it produced, where output should go, and how failures are handled.

Example flow:

1. Fetch API response (`buffer` becomes response payload).
2. Validate shape/status.
3. Traverse to the required subtree.
4. Validate again for downstream expectations.
5. Hand off to a rendering/apply stage.

If the next operation needs a different DOM destination, move `target` and continue. This avoids one-off conditional glue and keeps operations reusable.

Authoring can stay lightweight or structured:

* inline DSL strings for quick local behavior
* structured config parameters for larger workflows
* literal function references or symbolic lookups for callable stages

The result is portable workflow logic: define operations once and reuse them across components.

## Example: Template + data stitching

Another common case is rendering a component by combining:

* a reusable template file
* data loaded from an API
* component-specific CSS assets

Teams often push this into server-side fragments, which can create friction:

* HTML designers need backend-template knowledge to edit fragments
* backend developers repeatedly slice or rewire designer output
* fragment logic and fragment styling drift across files and ownership boundaries

A cleaner model is:

1. Keep templates generic and reusable.
2. Load data from a REST-style API.
3. Configure ActiveTags to fetch template + data, stitch them, and attach required CSS/resources in one workflow.

This keeps concerns tidy while reducing duplicated rendering logic across backend and frontend boundaries.

```txt
<insert example here> (template + data + stitch pipeline code block)
```

## Result

You get:

* SPA-like interaction patterns without framework lock-in
* cleaner separation between markup, styling, and behavior configuration
* reusable component behavior that can be configured at runtime
* lower maintenance overhead as site complexity grows

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Configuration Model](./CONFIGURATION.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [README](../../README.md)


# --- end: usage/INTRODUCTION.md ---



# --- begin: usage/OPERATIONS_BUILTINS.md ---

# Builtins & Operations — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


Builtins are VM-callable operation functions used inside pipeline stages.

Root builtin export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

---

## Builtin families

### Form

* `form.collect`
* `form.prepare`
* `form.submit`
* `form.headers`

Source: [../../src/builtins/form/](../../src/builtins/form/)

### DOM

* `dom.patch`

Source: [../../src/builtins/dom/](../../src/builtins/dom/)

### Error

* `error.dump`
* `error.fail`

Source: [../../src/builtins/error/](../../src/builtins/error/)

### Buffer conveyor

* `buffer.set`
* `buffer.get`
* `buffer.clear`
* `buffer.traverse`

Source: [../../src/builtins/buffer/index.js](../../src/builtins/buffer/index.js)

### Target conveyor

* `target.reset`
* `target.set`
* `target.fromBuffer`
* `target.toBuffer`
* `target.closest`
* `target.find`
* `target.parent`
* `target.child`

Source: [../../src/builtins/target/index.js](../../src/builtins/target/index.js)

### HTTP

* `http.send` (namespace form from builtins root)

Source: [../../src/builtins/httpSend.js](../../src/builtins/httpSend.js)

---

## Stage result contract

Builtin ops should return normalized stage-like responses (`ok`, `wait`, `error`, `complete`) that VM can process consistently.

See helper contract shapes in:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## Related

* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Builtins subsystem notes -> [../architecture/subsystems/BUILTINS_BUFFER_TARGET.md](../architecture/subsystems/BUILTINS_BUFFER_TARGET.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/OPERATIONS_BUILTINS.md ---



# --- begin: usage/QUICKSTART.md ---

# Quick Start — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This guide gets you from zero to a running ActiveTags instance quickly.

---

## 1) Load required dependencies

ActiveTags expects a valid `lib` instance plus required services to be available.
The `lib` reference can come from an import, DI container, or any stored variable.

In this repository's example setup, service modules are loaded before ActiveTags:

* event delegator
* interval manager
* DOM change observer
* log service
* form service
* interpolation helper

See: [../../examples/test1.html](../../examples/test1.html)

---

## 2) Import and construct

```js
import ActiveTags from "../../src/ActiveTags.js";
import lib from "/m7-js-lib/...";

const AT = new ActiveTags(lib, {
  boot: {
    observeDom: true,
    events: true,
    intervals: true,
  }
});
```

Construction performs:

* top-level config compilation
* service resolution
* subsystem instantiation

No discovery or runtime triggers are active yet.

---

## 3) Start runtime

```js
await AT.start();
```

`start()` performs:

* initial DOM scan via discover controller
* optional observer start
* event/interval registration
* event/interval activation per boot flags

---

## 4) Mark active elements

At minimum, ActiveTags scans for:

```html
<div data-activetag></div>
```

Default selector is configured in top-level schema (`boot.selector`).

---

## 5) Validate with repository example

Use these files as first references:

* Boot page -> [../../examples/test1.html](../../examples/test1.html)
* Example config -> [../../examples/test-job.js](../../examples/test-job.js)
* Example pipelines -> [../../examples/testPipe.js](../../examples/testPipe.js)

---

## Next steps

* Basic tag setup -> [BASIC_TAG_SETUP.md](./BASIC_TAG_SETUP.md)
* Configuration guide -> [CONFIGURATION.md](./CONFIGURATION.md)
* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Builtins guide -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* API index -> [../api/INDEX.md](../api/INDEX.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/QUICKSTART.md ---



# --- begin: usage/REQUIREMENTS.md ---

# Requirements — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page defines the runtime requirements for ActiveTags.

## Version baseline

ActiveTags requires:

1. [m7-js-lib v1 or later](/m7-js-lib/...)
2. [m7-js-lib-primitive-* modules](/m7-js-lib-primitive-.../)

## Required runtime surface

At runtime, a valid m7 `lib` instance must be available with these dependency keys.
The reference may come from an import, DI container, or any stored variable.
No global `window.lib` binding is required.

* [hash](/hash/...)
* [primitive.workspace](/primitive.workspace/...)
* [dom](/dom/...)
* [str.interp](/str.interp/...)

## Required services

ActiveTags requires these service keys:

* [primitive.dom.eventdelegator](/primitive.dom.eventdelegator/...)
* [primitive.log](/primitive.log/...)
* [primitive.interval](/primitive.interval/...)
* [primitive.dom.changeobserver](/primitive.dom.changeobserver/...)

Service constants are defined in:

* [../../src/constants.js](../../src/constants.js)

## Runtime form helpers

Form and HTTP-related builtins expect form helpers on `lib.site.form`, including:

* `lib.site.form.collect`
* `lib.site.form.submit`

Current integration posture is to include these in the m7-js-lib v1 distribution.

## Minified distribution posture

The ActiveTags minified distribution is intended to include required primitive/runtime dependencies directly.

Including ActiveTags directly should not negatively affect minified installation behavior.

## Verification checklist

Before constructing ActiveTags, verify:

* a valid `lib` instance is available for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` resolves core dependencies
* `lib.require.service(...)` resolves required services
* `lib.site.form.collect` and `lib.site.form.submit` are available when form/HTTP builtins are used

---

## See also

* [Installation & Dependencies](./INSTALLATION.md)
* [Quick Start](./QUICKSTART.md)
* [Troubleshooting](./TROUBLESHOOTING.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)


# --- end: usage/REQUIREMENTS.md ---



# --- begin: usage/RUNTIME_LIFECYCLE.md ---

# Runtime Lifecycle — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This page describes runtime flow from construction to execution.

---

## 1) Construction

`new ActiveTags(lib, conf)`:

* compiles top-level config snapshot
* resolves required services
* creates subsystem controllers
* creates JobRegistry and Engine

Reference: [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## 2) Start

`await AT.start()`:

1. validates environment document
2. performs initial discover scan
3. starts observer if configured
4. registers intervals/events from jobs
5. enables intervals/events per boot gates

---

## 3) Trigger phase

Runtime triggers enqueue tickets; they do not execute pipelines directly:

* event controller
* interval controller
* manual enqueue (`engine.enqueue(...)` / trait helpers)

---

## 4) Execution phase

Engine runtime model:

* enqueue creates ticket
* `tick()` advances one stage
* `drain()` loops ticks until idle/max
* VM normalizes stage results (`ok|wait|error|complete`)

Core files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## 5) Dataflow phase

Within a ticket:

* `buffer` carries stage-to-stage payload/meta
* `target` tracks current DOM operation focus

This explicit conveyor model is a core design strength for deterministic workflows.

---

## Related

* Builtins & operations -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* Engine architecture -> [../architecture/subsystems/ENGINE_AND_VM.md](../architecture/subsystems/ENGINE_AND_VM.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/RUNTIME_LIFECYCLE.md ---



# --- begin: usage/TOC.md ---

# Usage Documentation — Table of Contents

[README](../../README.md) -> [Usage TOC](./TOC.md) -> [Architecture Index](../architecture/INDEX.md) -> [API Index](../api/INDEX.md)


This section contains practical, user-facing guides for integrating and operating ActiveTags.

If you are looking for API-oriented references, see:

* **API Index** -> [../api/INDEX.md](../api/INDEX.md)
* **What Makes ActiveTags Different** -> [../WHAT_MAKES_US_DIFFERENT.md](../WHAT_MAKES_US_DIFFERENT.md)

If you are new, read top-to-bottom.

---

## Getting Started

* **Introduction** -> [INTRODUCTION.md](./INTRODUCTION.md)
  Problem framing, inline vs external config posture, and why ActiveTags exists.

* **About ActiveTags** -> [../ABOUT.md](../ABOUT.md)
  Internal model overview: compiler/VM pipeline, buffer/target conveyor, and runtime architecture posture.

* **Quick Start** -> [QUICKSTART.md](./QUICKSTART.md)
  Minimal boot flow and first active job.

* **Basic Tag Setup** -> [BASIC_TAG_SETUP.md](./BASIC_TAG_SETUP.md)
  Practical setup patterns for one `data-activetag` element, including `data-*`/`at-*` config sources and layered references.

* **Installation & Dependencies** -> [INSTALLATION.md](./INSTALLATION.md)
  Required m7 services, module loading, and runtime prerequisites.

* **Requirements** -> [REQUIREMENTS.md](./REQUIREMENTS.md)
  Version baseline, required dependency keys/services, and minified distribution posture.

---

## Configuration & Runtime

* **Configuration Model** -> [CONFIGURATION.md](./CONFIGURATION.md)
  Top-level runtime config and per-job config compile model.

* **v098 DSL Manual** -> [DSL_V098.md](./DSL_V098.md)
  Expression target grammar (`type:locator`), dispatch targets, interpolation, and compatibility notes.

* **Runtime Lifecycle** -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
  From `new ActiveTags(...)` through `start()`, enqueue, tick, and drain.

* **Builtins & Operations** -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
  Builtin operation families, buffer/target flow, and usage posture.

---

## Examples

* **Examples Library** -> [EXAMPLES_LIBRARY.md](./EXAMPLES_LIBRARY.md)
  Guided walkthrough of the repository examples and expected runtime behavior.

* **Examples/** -> [../../examples](../../examples)
  Local runnable examples and test rigs.

---

## Operational Guidance

* **Troubleshooting** -> [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
  Common boot/config/runtime errors and resolution patterns.

---

## Related Docs

* **Architecture Index** -> [../architecture/INDEX.md](../architecture/INDEX.md)
* **API Index** -> [../api/INDEX.md](../api/INDEX.md)
* **Use Policy** -> [../USE_POLICY.md](../USE_POLICY.md)
* **AI Disclosure** -> [../AI_DISCLOSURE.md](../AI_DISCLOSURE.md)
* **About ActiveTags** -> [../ABOUT.md](../ABOUT.md)
* **Project README** -> [../../README.md](../../README.md)

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/TOC.md ---



# --- begin: usage/TROUBLESHOOTING.md ---

# Troubleshooting — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


Common startup and runtime issues.

---

## Constructor throws: missing lib

Error pattern:

* `constructor requires lib as first argument`

Fix:

* Ensure a valid `lib` instance is available and passed as the first constructor argument.
* If using `auto.js`, ensure `window.lib` exists before auto-registration executes.

---

## Constructor throws: missing core services

Error pattern includes missing service keys.

Fix:

* Load/register service modules before creating ActiveTags:
  * event delegator
  * interval manager
  * DOM change observer
  * log service

See dependency guide: [INSTALLATION.md](./INSTALLATION.md)

---

## start() throws missing document/body

Error pattern:

* missing doc or doc body

Fix:

* Ensure browser DOM is available and call `start()` after DOM readiness.

---

## No jobs discovered

Symptoms:

* no event/interval registrations
* no pipeline activity

Fix checklist:

* selector matches (`boot.selector` default is `[data-activetag]`)
* elements exist at start time
* per-job config compiles successfully

---

## Pipelines enqueue but do not behave as expected

Check:

* job schema `enabled` / `autorun`
* stage op names match builtin/custom callable names
* `buffer` and `target` assumptions across stages
* error-phase pipeline presence

---

## Observer behavior surprises

Check:

* `boot.observeDom` gate
* `observe.selector` and `observe.attribute_filter` alignment
* underlying observer service contract

Reference:

* [../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)

---

## Next debugging surfaces

* ActiveTags runtime entry -> [../../src/ActiveTags.js](../../src/ActiveTags.js)
* Engine/tick/VM path -> [../../src/class/engine/](../../src/class/engine/)
* Job config compile path -> [../../src/class/job/config/](../../src/class/job/config/)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)


# --- end: usage/TROUBLESHOOTING.md ---



# --- begin: USE_POLICY.md ---

# 📘 M7-JS-LIB-ACTIVE-TAGS Use Policy

This document outlines how you may use M7-JS-LIB-ACTIVE-TAGS under the **Moderate Team License (MTL-10)** and what is expected of you as a user.

---

## ✅ Free Use — What You Can Do

You may use M7-JS-LIB-ACTIVE-TAGS **for free** if you fall under any of the following categories:

* **Individuals** using it for personal projects, learning, or experimentation
* **Academic institutions or researchers** using it for teaching, papers, or labs
* **Nonprofits and NGOs** using it internally without revenue generation
* **Startups or companies** with **10 or fewer users** of M7-JS-LIB-ACTIVE-TAGS internally

  * This includes development, deployment, and operational use

There is **no cost, license key, or approval required** for these use cases.

---

## 🚫 Commercial Restrictions

M7-JS-LIB-ACTIVE-TAGS **may not be used** in the following ways without a paid commercial license:

* As part of a **commercial product** that is sold, licensed, or monetized
* Embedded within a platform, device, or SaaS product offered to customers
* Internally at companies with **more than 10 users** working with M7-JS-LIB-ACTIVE-TAGS
* As a hosted service, API, or backend component for commercial delivery
* In resale, sublicensing, or redistribution as part of paid offerings

---

## 🔒 Definitions

* **User**: Anyone who installs, configures, modifies, integrates, or interacts with M7-JS-LIB-ACTIVE-TAGS as part of their role.
* **Commercial use**: Use in a context intended for revenue generation or business advantage (e.g. SaaS, enterprise ops, service platforms).

---

## 💼 Licensing for Larger or Commercial Use

If your company, product, or service falls outside the free use scope:

📩 **Contact us at \[[legal@m7.org](mailto:legal@m7.org)]** to arrange a commercial license.

Licensing is flexible and supports:

* Enterprise support and maintenance
* Extended deployment rights
* Integration into proprietary systems
* Long-term updates and private features

---

## 🤝 Community Guidelines

* Contributions are welcome under a Contributor License Agreement (CLA)
* Respect user limits — we reserve the right to audit compliance
* We appreciate feedback and security reports via \[[security@m7.org](mailto:security@m7.org)]

---

## 📝 Summary

| Use Case                            | Allowed?      |
| ----------------------------------- | ------------- |
| Hobby / personal projects           | ✅ Yes         |
| Research or academic use            | ✅ Yes         |
| Internal team use (≤ 10 people)     | ✅ Yes         |
| SaaS / resale / commercial platform | ❌ License req |
| Internal use by >10 users           | ❌ License req |

---

This policy supplements the terms in `LICENSE.md` and helps clarify user expectations.


# --- end: USE_POLICY.md ---



# --- begin: vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md ---

# DomChangeObserver API Contract

**(m7-js-lib-primitive-dom-changeobserver)**

> **You may paste this file directly into another project so that an LLM can correctly reason about and use the software.**
> This document defines the **public API contract only**.
> It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for `DomChangeObserver`, including:

* construction and lifecycle
* selector registry behavior
* batch and record semantics
* handler guarantees
* data shapes
* error and environment guarantees
* optional `auto.js` integration behavior

This contract does **not** define:

* internal data structures
* private methods
* implementation optimizations
* undocumented side effects

---

## Core concepts

### Root

A **root** is the single DOM node whose subtree is observed.

Valid root types:

* `Element`
* `Document`
* `DocumentFragment`

Exactly one root is active at any time.

---

### Selector

A **selector** is a CSS selector string defining relevance.

Selectors:

* may be enabled or disabled
* may have locked, per-selector options
* participate only when enabled

---

### Lifecycle buckets

All reported changes are expressed in **four selector-relevant lifecycle buckets**:

* `added`
* `removed`
* `changed`
* `changeAway`

These buckets describe **selector membership transitions**, not raw DOM mutations.

---

## Fundamental guarantees

DomChangeObserver guarantees:

1. **Reporting-only behavior**  
   It reports DOM changes. It does not mutate state, attach jobs, or schedule work beyond batching.

2. **Selector relevance**  
   Only enabled selectors produce records.

3. **Explicit lifecycle buckets**  
   All output is expressed via `added`, `removed`, `changed`, `changeAway`.

4. **Batch-based delivery**  
   Changes are delivered in batches, never as raw MutationObserver records.

5. **Deterministic lifecycle**  
   Observation begins only after `start()` and ends after `stop()` or `pause()`.

---

## Module exports & integration

### Standard usage

The module exports the `DomChangeObserver` constructor.  
Exact export wiring depends on the entry module.

### `auto.js` integration (optional)

When used with **m7-lib**, `auto.js`:

* registers a namespace object via: `lib.hash.set(lib, "primitive.dom.changeobserver", {...})`
* registers a default singleton instance as a service under the key:  
  `"primitive.dom.changeobserver"`

`auto.js` **must not** alter runtime semantics defined by this contract.

---

## Public API surface

### Construction

#### `new DomChangeObserver(opts?)`

Construction does **not** start observation.

DOM access does not occur until `start()`.

---

## Lifecycle API

### `start() → true`

* Starts observation
* Idempotent
* Validates:
  * a valid root exists
  * `MutationObserver` is available

Throws on failure.

### `stop() → void`

* Disconnects observer
* Clears pending batches
* Cancels timers
* Preserves selectors and configuration

### `pause() → true`

* Stops observation
* Preserves pending batches

### `resume() → true`

Alias of `start()`.

### `state() → "running" | "paused"`

Returns lifecycle state.

### `isRunning() → boolean`

Returns whether observation is active.

---

## Root management

### `setRoot(newRoot, host?) → boolean`

* Replaces the active root
* Re-observes if currently running
* Resets selector membership baseline

Returns `false` if the root is unchanged.

Throws if `newRoot` is invalid.

---

## Configuration

### `configure(cfg) → this`

Applies global configuration **without changing the root**.

* `selectors` replaces the selector registry
* `root` is **forbidden** here

Throws if `cfg.root` is provided.

---

## Selector registry API

### `setSelectors(selectors) → void`

Hard reset:

* clears pending records
* resets selector stats
* resets membership baseline

### `addSelector(selector, opts?) → boolean`

Registers a selector.

Returns `false` if invalid or already present.

Options are locked at registration time.

### `removeSelector(selector) → boolean`

Removes selector and scrubs pending state.

### `pauseSelector(selector, opts?) → boolean`

Disables selector.

Optional: `opts.dropPending === true` drops pending records.

### `resumeSelector(selector) → boolean`

Re-enables selector.

### `setSelectorEnabled(selector, on) → boolean`

Hard enable/disable.

### `hasSelector(selector) → boolean`

Existence test.

### `getSelector(selector, opts?) → SelectorInfo | null`

Returns selector state and optional stats.

### `listSelectors(opts?) → SelectorInfo[]`

Lists all selectors and optional stats.

### `getSelectors() → string[]`

Returns the list of currently **enabled** selector strings.

### Convenience aliases

If present:

* `add(selector, onEvent?)`
* `remove(selector)`

Must behave identically to their canonical counterparts.

---

## Delivery & pull-style consumption

### `flush() → DomChangeBatch | null`

Immediately delivers pending records.

Cancels any debounce timer.

### `takePending() → DomChangeBatch | null`

Pull-style API:

* returns pending batch
* clears pending state
* does **not** invoke handlers

---

## Record semantics

### `added`

Element newly present in the subtree **and** matching one or more enabled selectors  
**at collection time** (during mutation processing).

Note: the implementation does not re-check selector matches at delivery time.

### `removed`

Element removed from the subtree **and** matching one or more selectors at removal time.

Best-effort.

Note: collection is performed during mutation processing; delivery may be deferred.

### `changed`

Selector membership transition:

* NOT matching → matching
* Caused by attribute changes
* Only when attribute observation is enabled

### `changeAway`

Selector membership transition:

* matching → NOT matching
* Caused by attribute changes
* Only when attribute observation is enabled

---

## Handler contract

### Global handler: `onChange(batch)`

* Fires for every delivered batch
* Synchronous
* Never awaited

### Per-selector handler: `onEvent(evt)`

* Fires only if selector has relevant records
* Fires **in addition** to `onChange`
* Receives selector-scoped lifecycle buckets

### Failure behavior

All handler failures are **swallowed**.

Observation must continue.

---

## Timing & ordering

* No strict ordering guarantee. Treat lifecycle arrays as sets.
* No ordering guarantee across batches
* Timestamps are informational only

---

## Environment requirements

Required:

* DOM environment with:
  * `MutationObserver`
  * `Element.prototype.matches`
  * `querySelectorAll`

Supported:

* Browsers
* jsdom

Not supported:

* Plain Node.js (no DOM)

---

## Data shapes (normative)

### `DomChangeRecord`

```ts
type DomChangeRecord = {
  el: Element
  selectors: string[]
}
```

### `DomChangeBatch`

```ts
type DomChangeBatch = {
  at: number
  selectors: string[]
  added: DomChangeRecord[]
  removed: DomChangeRecord[]
  changed: DomChangeRecord[]
  changeAway: DomChangeRecord[]
}
```

### `SelectorEvent`

```ts
type SelectorEvent = {
  at: number
  selector: string
  added: DomChangeRecord[]
  removed: DomChangeRecord[]
  changed: DomChangeRecord[]
  changeAway: DomChangeRecord[]
  batchAt: number
  enabledSelectors: string[]
}
```

### `SelectorStats`

```ts
type SelectorStats = {
  events: number
  matched: number
  added: number
  removed: number
  changed: number
  changeAway: number
  lastAt: number
}
```

### `SelectorInfo`

```ts
type SelectorInfo = {
  selector: string
  enabled: boolean
  stats?: SelectorStats
}
```

---

## Errors & throw behavior

Methods may throw only in these cases:

* `start()`:
  * invalid or missing root
  * missing `MutationObserver`
  * observer attachment failure

* `setRoot()`:
  * invalid root type

* `configure()`:
  * attempt to set `root`

* `stop()` / `pause()`:
  * disconnect failure (rare; best-effort wrapper)

If an error occurs during attachment, the observer must not claim to be running.

---

## Explicit non-guarantees

DomChangeObserver does **not** guarantee:

* capture of all attribute changes
* capture of text mutations
* stable identity across remove/reinsert
* real-time delivery
* delivery under catastrophic DOM failure

---

## Forward compatibility

Future versions may:

* extend selector options
* add metadata
* add optional delivery controls

Existing semantics will not be weakened.

---

## Philosophy

> **Observe precisely. Decide elsewhere.**

This contract exists to enforce that boundary.


# --- end: vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md ---



# --- begin: vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md ---

# EventDelegator API Contract

**(m7-js-lib-primitive-dom-eventdelegator)**

> **You may paste this file directly into another project so that an LLM can correctly reason about and use the software.**
> This document defines the **public API contract only**.
> It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for `EventDelegator`, including:

* construction and lifecycle
* root and listener management
* handler registration and routing semantics
* propagation policy guarantees
* data shapes
* error and environment guarantees
* optional `auto.js` integration behavior

This contract does **not** define:

* internal data structures
* private methods
* implementation optimizations
* undocumented side effects

---

## Core concepts

### Root

A **root** is the single event target on which native listeners are attached.

Valid root types:

* any object implementing `addEventListener` / `removeEventListener` (typically `Document`, `Element`, `ShadowRoot`, or `DocumentFragment`)

Exactly one root is active at any time.

---

### Handler

A **handler** is a delegated event route defined by:

* event type
* selector
* handler function
* explicit policy options
* listener options
* optional tag

Handlers participate only while the delegator is running.

---

## Fundamental guarantees

EventDelegator guarantees:

1. **Routing-only behavior**  
   It routes events. It does not schedule async work, attach jobs, or manage application state.

2. **Single-listener consolidation**  
   At most one native listener is attached per `(event type + listener options bucket)` per root.

3. **Explicit selector routing**  
   Events are routed only when the selector match succeeds according to declared strategy.

4. **Declarative propagation policy**  
   `preventDefault` / `stopImmediatePropagation` are applied **only** when explicitly declared.

5. **Deterministic lifecycle boundaries**  
   Routing begins only after `start()` and ends after `stop()` / `pause()` / `dispose()`.

---

## Module exports & integration

### Standard usage

The module exports the `EventDelegator` constructor.

### `auto.js` integration (optional)

When used with **m7-lib**, `auto.js`:

* registers a namespace via: `lib.hash.set(lib, "primitive.dom.eventdelegator", {...})`
* registers a default singleton instance as a service under the key: `"primitive.dom.eventdelegator"`
* resolves a DOM `document` root (from `lib._env.root.document` or the realm host)
* creates an instance and attempts to set the root and start it (best-effort; failures are logged)

`auto.js` **must not** alter runtime semantics defined by this contract.

---

## Public API surface

### Construction

#### `new EventDelegator(config?)`

```js
const delegator = new EventDelegator({
  root: document,
  host,                 // optional
  callbackError,        // optional
  ...reserved           // ignored, stored
});
```

**Behavior**

* `root` is **optional** at construction.
  * If provided, `setRoot(root, host)` is invoked and will throw if the root is invalid.
  * `start()` throws if no root is configured.
* Construction does **not** attach listeners or route events until `start()`.
* Unknown config keys are accepted and stored for future use (but otherwise ignored).

**Throws**

* If `root` is provided, but invalid.

---

## Lifecycle API

### `start() → void`

* Attaches all required native listeners to the current root and begins routing.
* Idempotent (calling when already running is a no-op).
* May throw if listener attachment fails.
* Throws if no root is configured.

### `stop() → void`

* Detaches all currently attached native listeners from the root.
* Preserves registered handlers (routes remain registered).

### `pause() → void`

Alias of `stop()`.

### `resume() → void`

Alias of `start()`.

### `state() → "running" | "paused"` **until disposed**

Returns lifecycle state. After `dispose()`, state is undefined / not guaranteed.

### `isRunning() → boolean`

Returns whether routing is active.

---

## Root management

### `setRoot(newRoot, host?) → this`

* Replaces the active root.
* If currently running:
  * detaches listeners from the old root, then
  * re-attaches listeners to the new root.
* If `host` is provided (including `null`), it is forwarded to `setHost(host)`.

**Throws**

* If the instance is disposed.
* If `newRoot` is missing or invalid (must implement `addEventListener/removeEventListener`).

---

## Host & error policy

### `setHost(host) → this`

Sets or replaces the host environment surface.

**Accepted values**

* `null` / `undefined` → clears the host.
* an `object` or `function` (but **not** an Array) → stored as the host after validation.

**Validation**

If `host` is provided (non-null), and any of the following properties exist on it, they **must** be functions:

* `host.matches`
* `host.closest`
* `host.getPath`
* `host.validateSelector`
* `host.onError`

**Throws**

* If called after `dispose()`.
* If `host` is provided but is not an object/function, or is an Array.
* If any provided capability is present but not a function.



### `setCallbackError(fn?) → this`

Sets handler error policy.

**Accepted values**

* `fn === undefined` → restores default policy (`(msg, err) => console.error(msg, err)`).
* `fn === null` → swallow handler errors silently.
* `typeof fn === "function"` → use `fn` as the policy.

**Callback signature**

When a delegated handler throws, the policy function is invoked as:

```ts
fn(message: string, error: unknown, context: {
  eventType: string;
  selector: string;
  event: Event;
  matched: Element;
}): void
```

The delegator never lets errors thrown by the policy escape (policy failures are swallowed).

**Throws**

* If called after `dispose()`.
* If `fn` is provided but is not a function, `null`, or `undefined`.


---

## Handler registry API

### `on(spec) → () => void`

Registers a delegated handler and returns an **unsubscribe** function.

```js
const off = delegator.on({
  eventType: "click",
  selector: ".btn",
  handler(evt) {
    // `this` is the element that matched the selector
  },
  options: { capture: false, passive: false, once: false },
  policy: { match: "closest", prevent: false, stop: false },
  tag: "ui"
});

// later
off();
```

Notes:

* Handlers registered while the delegator is running will cause the relevant native listener
  to be created/attached as needed.

---

### `set(spec) → () => void`

Registers a delegated handler with **replace semantics** for the selector **within a bucket**.

* The bucket is `(eventType + options)`.
* This overwrites the entire handler group for the given `selector` in that bucket.
* Returns an unsubscribe function (equivalent to calling `off(...)` with the same parameters).

---

### `off(spec) → void`

Removes handlers matching the given spec.

```js
delegator.off({
  eventType: "click",
  selector: ".btn",
  handler,          // optional
  options,          // optional (bucket selector)
  tag               // optional
});
```

Removal semantics:

* If neither `handler` nor `tag` is provided: removes **all** handlers for that `(eventType + options + selector)` route.
* If `handler` is provided: removes only handlers whose function equals `handler`.
* If `tag` is provided: removes only handlers whose tag equals `String(tag)`.
* If both `handler` and `tag` are provided: removes only those matching both.

Best-effort: if the target bucket/route does not exist, `off()` is a no-op.

---

### `offTag(tag) → void`

Removes **all handlers** associated with a given tag across all event types and options buckets.

`tag` is compared as `String(tag)`.

---

### `clear(eventType?) → void`

* If `eventType` is provided: clears all handlers for that event type and detaches any native listeners for that type.
* If omitted: clears **all handlers** and detaches **all native listeners**.

---

### Introspection

#### `list(eventType?) → Array<RouteInfo>`

Returns a snapshot of registered routes.

If `eventType` is provided, returns only that event type’s routes.

`RouteInfo` shape:

```ts
type RouteInfo = {
  eventType: string;
  selector: string;
  count: number;          // number of registered handlers for that selector in the bucket
  tags: string[];         // unique tags present (empty if none)
  tagCounts: Record<string, number>; // counts per tag
  options: any;           // normalized listener options used for the bucket
};
```

#### `count(eventType?) → number`

Returns number of registered handlers.

If `eventType` is provided, counts only that event type.

---

## Handler semantics

### Invocation

```js
function handler(evt) {
  // `this` is the element that matched the selector
}
```

* `evt` — the native event
* `this` — the matched element

Handlers:

* are synchronous
* are never awaited

If a handler throws:

* the error is handled by the configured `callbackError` policy
* routing continues to other handlers unless `policy.stop` was applied earlier in the same dispatch

---

## Matching semantics

`policy.match` determines how the match element is computed:

* `"closest"` (default)  
  Uses `evt.target.closest(selector)` (element must be an `Element`).

* `"target"`  
  Uses `evt.target.matches(selector)` (element must be an `Element`).

If `evt.target` is not an `Element`, the event does not match any selector route.

---

## Propagation policy

* `policy.prevent: true` → calls `evt.preventDefault()`
* `policy.stop: true` → calls `evt.stopImmediatePropagation()`

Policy is applied only when declared for a handler.

---

## Listener options

Listener options are the native `addEventListener` options.

The delegator buckets native listeners by `options` (normalized):

* `options.capture`
* `options.passive`
* `options.once`

Handlers with different normalized listener options are grouped under separate native listeners.

---

## Timing & ordering

* Handlers run during native event propagation.
* No ordering guarantee is made between routes or handlers.

---

## Disposal

### `dispose() → void`

Permanently tears down the delegator by:

* detaching all native listeners
* clearing all registered routes and handlers
* marking the instance as disposed

After disposal:

*  Public methods that mutate state **will throw**.
* `dispose()` is idempotent (calling it more than once is a no-op).
* Introspection methods are not guaranteed to work.

---

## Environment requirements

Required (minimum):

* `root.addEventListener` / `root.removeEventListener`
* `Element.prototype.matches` (for `"target"` matching)
* `Element.prototype.closest` (for `"closest"` matching)

Supported:

* Browsers
* jsdom (if it supplies the above)

Not supported:

* Plain Node.js (no DOM)

---

## Error & throw behavior

Public methods may throw in these cases:

* Construction / `setRoot()`:
  * Construction throws **only** if an explicitly provided `root` is invalid.
  * `setRoot()` throws if called on a disposed instance.
* Registration (`on` / `set`) may throw on invalid arguments:
  * missing or invalid `eventType`, `selector`, or `handler`
  * selector validation failure when host validation is enabled
* Lifecycle (`start`) may throw:
  * if no root is configured
  * if native listener attachment fails
* All other operations are best-effort (no-ops on missing routes or buckets), unless the instance is disposed.

If an error occurs during attachment, the delegator must not claim to be running.

---

## Explicit non-guarantees

EventDelegator does **not** guarantee:

* handler execution order
* delivery under catastrophic DOM failure
* interception of non-bubbling events unless capture is used
* framework compatibility guarantees

---

## Forward compatibility

Future versions may:

* extend handler options
* add metadata to introspection outputs
* add optional routing controls

Existing semantics will not be weakened.

---

## Philosophy

> **Route precisely. Decide elsewhere.**

This contract exists to enforce that boundary.


# --- end: vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md ---



# --- begin: vendor_api_contracts/INTERVAL_API_CONTRACT.md ---

# Interval API Contract (m7-js-lib-interval)

> **You may paste this file directly into another project so that an LLM knows how to correctly use the software.**
> This document defines the *public API contract only*. It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for **m7-js-lib-interval**, including:

* `IntervalManager` (central registry and lifecycle controller)
* `ManagedInterval` (per-interval execution engine)
* `auto.js` integration (optional browser convenience layer)

The goal is to allow correct integration and reasoning **without reading source code**.

---

## Core Concepts

### Interval lifecycle states

* **running** — eligible to schedule and execute work
* **paused** — retains state/config, no scheduling
* **cancelled** — permanently stopped; cannot be restarted

### Environment gating (manager-level)

* `visible: boolean` — whether the app/tab should be treated as visible
* `online: boolean` — whether the app should be treated as online
* `suspended: boolean` — global hard stop (highest priority)

### Policies (interval-level)

* **overlapPolicy** — behavior when a tick occurs while a run is inflight

  * `skip` | `coalesce` | `queue`
* **errorPolicy** — behavior when `fn(ctx)` throws or rejects

  * `continue` | `pause` | `cancel` | `backoff`

---

## Module Exports

### Standard usage

* `IntervalManager` (named export)
* `ManagedInterval` (named export)

### auto.js integration exports

* `IntervalManager`, `ManagedInterval` (named exports)
* `manager` alias → `IntervalManager`
* `interval` alias → `ManagedInterval`
* default export → `{ manager: IntervalManager, interval: ManagedInterval }`

---

## auto.js Integration Contract

### Purpose

When loaded in a browser environment with **m7-lib**, `auto.js` registers:

* `lib.interval.manager` → constructor for `IntervalManager`
* `lib.interval.interval` → constructor for `ManagedInterval`

### Preconditions

* Runs in a browser environment
* `window.lib` must exist
* `lib.hash.set` must be available

### Failure behavior

If any precondition is missing, `auto.js` throws an Error at load time.

---

# IntervalManager API

## Construction

### `new IntervalManager(opts?)`

#### Options

* `autoRemove: boolean` (default `true`)
* `pauseWhenHidden: boolean` (default `true`)
* `pauseWhenOffline: boolean` (default `true`)
* `onEvent: function | null` (default `null`)
* `clock: { now(), setTimeout(fn, ms), clearTimeout(id) } | null`
* `environment: { visible?, online?, suspended? }`

### Manager guarantees

* Maintains a registry of named intervals
* Enforces environment policy after start/resume and environment updates
* Once disposed, all control and mutation APIs throw; lookup and introspection APIs (`get`, `has`, `list`, `snapshot`) remain callable but operate on an empty registry.

---

## Registration & Lookup

### `manager.register(config) → ManagedInterval`

Registers or replaces a named interval.

**Required config**:

* `name: string`
* `fn: function(ctx)`

**Replacement invariant**:

* Existing interval with the same name is cancelled with reason `"replaced"`

---

### `manager.get(name) → ManagedInterval | null`

### `manager.has(name) → boolean`

### `manager.list() → string[]`

### `manager.snapshot(name?) → object | null`

Returns serializable snapshot(s) of interval state.

---

## Lifecycle Control

### `manager.start(name?)`

Starts one interval or all.

* Always followed by environment policy enforcement

### `manager.resume(name?)`

Alias of `start()`.

### `manager.pause(name?)`

Pauses interval(s) without destroying state.

### `manager.cancel(name?)`

Cancels interval(s) permanently.

### `manager.stopAll()`

Cancels all intervals with reason `"stopAll"`.
Manager remains usable.

### `manager.dispose()`

* Cancels all intervals with reason `"dispose"`
* Clears registry
* Permanently disables manager

---

## Execution & Signaling

### `manager.runNow(name, payload?)`

Requests an immediate execution attempt.

* Obeys overlap and environment rules

### `manager.step(name, reason?)`

Attempts exactly one run for the named interval (obeys environment gating), then ensures pause.

### `manager.signal(name, type, payload?)`

### `manager.signalAll(type, payload?)`

### `manager.setWorkspace(name, workspace)`

Replaces an interval's workspace object.
Throws if `workspace` is not an object.

---

## Environment Management

### `manager.updateEnvironment({ visible?, online?, suspended? })`

Policy order:

1. `suspended` — hard pause
2. `visible === false` — pause unless `runWhenHidden`
3. `online === false` — pause unless `runWhenOffline`

Resumes occur only if current environment allows execution.

---

## Telemetry (`onEvent`)

If provided, `onEvent(event)` receives structured lifecycle events.

Common event types:

* `register`, `start`, `pause`, `resume`, `cancel`
* `runNow`, `step`
* `environment`
* `maxRuns`, `remove`, `dispose`, `error`

Telemetry errors are swallowed and must not affect execution.

---

# ManagedInterval API

Instances are normally created via `manager.register(config)`.

---

## Configuration Schema

### Required

* `name: string`
* `fn: function(ctx)`

### Timing

* `everyMs: number` *(optional; default `1000`)*

Timing guarantees:

* `everyMs` is clamped to **≥ 1ms**
* if omitted or invalid, defaults to **1000ms**

### Optional

* `maxRuns: number` (default `0` = unlimited)
* `priority: 'low' | 'normal' | 'high'`
* `overlapPolicy: 'skip' | 'coalesce' | 'queue'`
* `maxQueue: number | null | undefined`
* `queueErrorPolicy: 'clear' | 'preserve' | 'cap' | 'dropOne'`
* `errorPolicy: 'continue' | 'pause' | 'cancel' | 'backoff'`
* `workspace: object`
* `runWhenHidden: boolean`
* `runWhenOffline: boolean`
* `onConstruct: function | null`
* `constructErrorPolicy: 'pause' | 'retry' | 'cancel'`
* `onDestroy: function | null`

---

## Interval Lifecycle Methods

### `interval.start(reason?)`

* Idempotent
* No-op if cancelled or manager disposed
* Obeys environment gating

### `interval.pause(reason?)`

### `interval.cancel(reason?)`

* Idempotent
* Invokes `onDestroy` at most once

### `interval.reset()`

Resets counters and transient execution state.

Does not change lifecycle status **except** that if the interval is currently running and environment policy blocks execution, the interval may transition to `paused`.

---

## Execution Methods

### `interval.runNow(payload?, reason?)`

* Requests immediate run attempt
* Applies overlap policy if inflight

### `interval.step(reason?)`

Attempts exactly one run (obeys environment gating).

Always pauses after completion.

### `interval.reschedule(inMs)`

One-shot override for the next scheduling delay.

---

## Signaling

### `interval.signal(type, payload?)`

* Stores signal for next tick
* Built-in control signals: `pause`, `cancel`, `start`, `resume`, `reset`, `runNow`

---

## Introspection

### `interval.snapshot() → object`

Returns a serializable snapshot of interval state.

### `interval.isRunnable() → boolean`

Returns true if the interval is eligible to execute work **or accept a pending run** under current conditions (environment gating, lifecycle status, and `maxRuns`).

* If a run is inflight, this may still return true when `overlapPolicy` allows pending work (`coalesce` or `queue`).

---

## Execution Context (`ctx`)

Provided to `fn(ctx)`.

Includes:

* Identity: `name`
* Timing: `now`, `startedAt`, `lastRunAt`, `nextRunAt`
* Counters: `runs`, `maxRuns`
* Metadata: `reason`, `lastReason`, `lastError`
* Workspace: `workspace`
* Read-only config hints: `everyMs`, `overlapPolicy`, `errorPolicy`, `priority`

> **Note:** Signals are consumed as control inputs before `fn(ctx)` runs. Therefore, a previously sent signal is **not guaranteed** to be visible inside `fn(ctx)` as `ctx.lastSignal`.

### Convenience controls on `ctx`

* `ctx.start()` / `ctx.pause()` / `ctx.cancel()`
* `ctx.runNow()` / `ctx.reschedule(inMs)`
* `ctx.signal(type, payload?)`

---

## Decision Object Contract

`fn(ctx)` may return:

* `{ action: 'pause' }`
* `{ action: 'cancel' }`
* `{ action: 'reschedule', inMs: number }`
* `{ action: 'continue' }` (or unknown → no-op)

---

## Cross-Cutting Invariants

* Registering the same name replaces safely
* Telemetry must never break execution
* Environment gating is always enforced after start/resume
* `step()` is single-run then pause
* Snapshots are JSON-serializable

---

## Integration Guidance for LLMs

* Treat this system as a **black-box scheduler**
* Rely only on APIs, guarantees, and invariants defined here
* If behavior is not specified, it must be treated as unknown

---

**End of Contract**


# --- end: vendor_api_contracts/INTERVAL_API_CONTRACT.md ---



# --- begin: vendor_api_contracts/LOG_API_CONTRACT.md ---

# Log Primitive API Contract (m7-js-lib-primitive-log)

> **You may paste this file directly into another project so that an LLM knows how to correctly use the software.**
> This document defines the *public API contract only*. It intentionally omits implementation details and source code.
>
> Anything not explicitly specified here must be treated as **undefined behavior**.

---

## Scope

This contract defines the **public, stable interface** for **m7-js-lib-primitive-log**, including:

* `Manager` (bucket registry + routing layer)
* `Worker` (single-bucket log stream + storage/policy container)
* `Record` shape (strict `{ header, body }`)
* `auto.js` integration (optional m7-lib registration layer)

The goal is to allow correct integration and reasoning **without reading source code**.

---

## Core Concepts

### Buckets

A **bucket** is a named log stream.
* A `Manager` owns many buckets (Workers).
* A `Worker` owns exactly one bucket.

There is intentionally **no default bucket**. If you only want one bucket, instantiate a `Worker` directly. 

### Records

Workers store records in a strict `{ header, body }` shape:

* `header` is system-owned metadata
* `body` is user-owned payload (opaque)

The Worker generates these header fields:

* `at` — timestamp of this record
* `source` — Worker name
* `level` — severity (`log`, `info`, `warn`, `error`, …)
* `lastAt` — previous timestamp for this Worker (when available)
* `delta` — `at - lastAt` (when available)

Optional header fields when provided to `emit()`:

* `event`
* `trace` 

### Storage policy

A Worker stores records in-memory:

* `max === 0` → unlimited storage (append-only)
* `max > 0` → ring buffer that retains the most recent `max` records 

### Enable gates

* `Manager.enabled` is a **global forwarding gate**: when false, `manager.log/info/warn/error` return `null` and do not forward. It does **not** mutate existing Workers. 
* `Worker.enabled` is a **bucket gate**: when false, `emit()` returns `null`, no records are stored, no hooks run, nothing prints. 

### Console policy

Console output is **policy-controlled** and **best-effort**:

* Per-call printing can be suppressed with `opts.print === false`.
* Per-call console policy override: `opts.console`.
* Otherwise uses the Worker’s `console` policy.
* Printing eligibility is decided by `utils.shouldPrint(record, { console: policy })`.
* Printer errors are swallowed. 

### Hooks (best-effort)

Workers support optional user-defined handlers:

* `onEvent(record, worker, workspace)` — called after acceptance + storage
* `onPrint(record, ctx, workspace)` — called when a record is printed

Both are:
* synchronous
* best-effort (errors swallowed)
* never awaited 

---

## Module Exports

### Standard usage

In module/manual environments, `Manager` and `Worker` are the primary public constructors (exact export wiring depends on your entry module).

### auto.js integration exports

When using `auto.js` in a browser with **m7-lib**, it registers an object at:

* `lib.primitive.log` containing:
  * `Manager`
  * `Worker`
  * `utils`
  * `constants` 

---

## auto.js Integration Contract

### Purpose

When loaded in a browser environment with **m7-lib**, `auto.js` registers the primitive into `window.lib` at `lib.primitive.log`. 

### Preconditions

* Browser environment (has `window`)
* `window.lib` must exist
* `lib.hash.set` must be available 

### Failure behavior

If any precondition is missing, `auto.js` throws an Error at load time. 

### Non-goals

`auto.js` performs registration only; it does **not** change runtime behavior of capture. 

---

# Manager API

## Construction

### `new Manager(opts?)`

#### Options

* `name: string` (default `'log'`) — informational name
* `enabled: boolean` (default `true`) — Manager-level forwarding gate
* `throwOnError: boolean` (default `false`) — special `error()` behavior (see below)
* `worker: object` (default `{}`) — default Worker env config applied to **new** buckets only
* `buckets: object | null` — eager bucket map `bucketName -> Worker options` 

---

## Manager enable gate

### `manager.setEnabled(on = true)`
### `manager.enable()` / `manager.disable()`
### `manager.isEnabled() -> boolean` 

Guarantees:

* Disabling the Manager prevents forwarding to Workers.
* It does not mutate existing Workers or their defaults. 

---

## Worker defaults

### `manager.setWorkerConfig(cfg = {}) -> object`

Defines or updates the default Worker environment configuration used when creating new buckets.

* Does not affect already-created buckets. 

Supported keys (Worker environment defaults):

* `enabled`, `max`, `console`, `onEvent`, `clock`, `workspace`, `clone`, `onPrint` 

---

## Bucket management

Bucket name rules:

* Must be a non-empty string
* Finite numbers are accepted and coerced to strings (`0` → `'0'`)
* Other values are invalid 

### `manager.createBucket(name, opts?) -> Worker`

Creates (or replaces) a bucket.

Notes:

* Per-bucket `opts` override Manager Worker defaults.
* If a bucket already exists, it is replaced in the registry (no teardown is performed). 

### `manager.bucket(name) -> Worker | null`

Soft lookup (does not create missing buckets).

* Returns `null` if name is invalid or bucket missing. 

### `manager.ensureBucket(name, opts?) -> Worker`

Get-or-create lookup. 

### `manager.configureBucket(name, patch?) -> Worker | null`

Configures a bucket at runtime (creates the bucket if missing).

Notes:

* If bucket exists, patch is applied via `Worker.configure(patch)`.
* Some keys are creation-only (notably `clone`) and are ignored for existing buckets.
* If bucket is missing, `workspace` and `clone` are applied at creation time if present. 

### `manager.to(bucketName) -> Worker | null`

Alias of `manager.bucket(bucketName)`. 

---

## Logging API

All logging methods are **soft** operations:

* If `manager.enabled === false` ⇒ returns `null`
* If the bucket is missing/invalid ⇒ returns `null`
* Otherwise forwards to the Worker and returns the stored record 

### `manager.log(bucketName, data, opts?)`
### `manager.info(bucketName, data, opts?)`
### `manager.warn(bucketName, data, opts?)`
### `manager.error(bucketName, data, opts?)` 

#### `throwOnError` behavior (`manager.error`)

When `throwOnError === true`, `error()` throws after handling.

* If bucket missing/invalid: prints payload via `console.error` then throws.
* If bucket exists: records via Worker, suppresses Worker printing (avoid double-print), prints once via `console.error`, then throws an Error that includes:
  * `err.bucket`
  * `err.record` 

---

## Reading / clearing

### `manager.get(bucketName, filter = {}) -> Object[]`

* Validates bucketName (throws if invalid).
* If bucket missing, returns `[]`.
* Filter forwarded to `Worker.get(filter)`. 

### `manager.clear(bucketName?) -> void`

* If `bucketName` is null/undefined: clears all buckets.
* Otherwise clears only the named bucket (no-op if missing).
* Validates bucketName when provided (throws if invalid). 

### `manager.list() -> Array<Object>`

Returns an array of `Worker.stats()` snapshots. 

---

# Worker API

## Construction

### `new Worker(opts?)`

Options (selected highlights):

* `name: string` (default `'default'`) — stored as `record.header.source`
* `max: number|string|false|null|undefined` (default `0` unlimited; invalid values throw)
* `enabled: boolean` (default `true`)
* `console: number|string|boolean|null|undefined` — console policy
* `onEvent`, `onPrint` — best-effort hooks
* `clock` — time source (invalid values throw)
* `clone: boolean` (default `false`) — default per-record cloning policy
* `workspace: any` — opaque user workspace, passed into hooks/printers 

---

## Policy methods

### `worker.configure(patch = {}) -> void`

Patch keys:

* `enabled`, `max`, `console`, `onEvent`, `onPrint`, `clock`, `workspace`

Throws if patch is not an object, or if patched values are invalid. 

### `worker.setEnabled(on = true) -> void`

When disabled, `emit()` and storage drop records and return null. 

### `worker.setLogMax(value) -> void`

* `0`/falsy/`"0"` => unlimited
* positive integer => ring buffer size
* invalid values => throws
* truncates immediately if reducing below current size 

### `worker.truncate() -> void`

Enforces `max` against current storage.

* no-op when `max === 0`
* keeps most recent `max` when ring mode 

### `worker.setConsoleLevel(value) -> void`

Sets the console emission policy (normalized internally). 

---

## Emitting records

### `worker.emit(data, opts?) -> Object | null`

Behavior:

* If disabled → returns `null`
* Normalizes payload into `record.body`
* Builds a `{ header, body }` record with timing metadata
* Optionally clones body best-effort (per call or Worker default)
* Stores record (unlimited or ring)
* Fires `onEvent` best-effort
* Optionally prints best-effort 

`emit()` options:

* `level: string` (default `'log'`) → `record.header.level`
* `event: string` (optional) → `record.header.event`
* `trace: any` (optional) → `record.header.trace`
* `clone: boolean` (default Worker policy) → cloning override
* `print: boolean` (default `true`) → suppress printing if false
* `console: any` (default Worker policy) → console policy override 

### Convenience level wrappers

Thin wrappers around `emit()`:

* `worker.log(data, opts?)` → `level: 'log'`
* `worker.info(data, opts?)` → `level: 'info'`
* `worker.warn(data, opts?)` → `level: 'warn'`
* `worker.error(data, opts?)` → `level: 'error'` 

---

## Reading records

### `worker.get(filter?) -> Object[]`

Guarantees:

* Returned records are in chronological order (oldest → newest), regardless of internal storage mode. 

Special filters:

* `since: number (epoch ms)` → filters out records with `record.header.at < since`
* `limit: non-negative integer` → returns most recent `limit` after filtering
  * `limit: 0` returns `[]`
  * invalid `limit` throws 

Key routing rules:

* `"header.foo"` targets `record.header["foo"]` (literal key; no path traversal)
* `"body.bar"` targets `record.body["bar"]` (literal key; no path traversal)
* Bare keys:
  * known header fields (`at`, `source`, `level`, `event`, `trace`) target header
  * everything else targets body 

Value matching:

* Scalars use strict equality (`===`)
* Functions treated as predicates `(value, record) => boolean`
  * predicate errors swallowed and treated as non-match 

---

## Clearing records

### `worker.clear() -> void`

Clears stored records and resets internal storage counters, but `_lastAt` is intentionally preserved for timing continuity / async workflows. 

---

## Introspection

### `worker.stats() -> object`

Returns:

```js
{
  name: string,
  enabled: boolean,
  max: number,
  size: number,   // retained
  count: number,  // accepted since last clear
  ring: boolean   // max > 0
}


# --- end: vendor_api_contracts/LOG_API_CONTRACT.md ---



# --- begin: WHAT_MAKES_US_DIFFERENT.md ---

# What Makes ActiveTags Different

[README](../README.md) -> [Usage TOC](./usage/TOC.md) -> [Architecture Index](./architecture/INDEX.md) -> [API Index](./api/INDEX.md)

ActiveTags is a DOM-declared workflow runtime built for medium-to-high complexity websites.

It is intentionally different in a few core ways.

---

## 1) Multi-source configuration model

Behavior can be authored in multiple equivalent forms:

* inline HTML attributes
* JSON-style config objects
* references to existing external configuration

This lets teams choose the right authoring surface per context without changing runtime semantics.

---

## 2) Compile-first + VM runtime

ActiveTags is not just trigger wiring.

It acts as:

* a compiler (normalizes config into deterministic runtime shape)
* a VM runtime (executes staged tickets with explicit status transitions)

Execution follows one deterministic spine instead of ad-hoc callback chains.

---

## 3) Glue code elimination by design

ActiveTags is built to remove integration glue between:

* event wiring
* request orchestration
* timer-driven behavior
* mutation-driven behavior
* DOM patch targeting and data handoff

In short: it murders glue. Dead.

---

## 4) Framework-like capabilities without platform ownership

ActiveTags targets complex sites without forcing platform-owning architecture.

It provides framework-like runtime capabilities while preserving standard DOM + server-rendered workflows.

---

## 5) Works with standard JavaScript

No proprietary language is required.

Teams can build with standard JavaScript and standard browser/module loading patterns.

---

## 6) Script-link friendly deployment posture

ActiveTags can be consumed through a simple script/module include model.

Operationally, this enables shipping a precompiled/minified distribution while preserving the same runtime model.

---

## See also

* [README](../README.md)
* [Usage TOC](./usage/TOC.md)
* [Architecture Index](./architecture/INDEX.md)
* [API Index](./api/INDEX.md)


# --- end: WHAT_MAKES_US_DIFFERENT.md ---

