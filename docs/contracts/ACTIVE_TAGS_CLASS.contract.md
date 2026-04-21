# ActiveTags Class Contract

[README](../../README.md) -> [API Index](../api/INDEX.md) -> [Source Contracts](./INDEX.md) -> [ActiveTags Class Contract](./ACTIVE_TAGS_CLASS.contract.md)

Source: [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## Purpose

`ActiveTags` is the top-level runtime orchestrator for DOM-bound jobs.

It is responsible for:

* compiling runtime configuration
* resolving required dependencies/services
* wiring core controllers around the engine
* exposing runtime activation via `start()`

It is not a template engine, virtual DOM, or framework state store.

---

## Constructor Contract

Signature:

* `new ActiveTags(lib, conf = {})`

Inputs:

* `lib`: initialized m7 lib instance
* `conf`: user overrides merged by schema against defaults

Constructor guarantees:

1. Compiles config snapshot through schema and stores as `this.conf`.
2. Asserts required dependency/service contracts:
   * `LIB_HASH`
   * `CORE_DEPS`
   * `CORE_SERVICES`
3. Maps resolved core services into semantic slots on `this.svc`.
4. Initializes runtime components:
   * expression resolver
   * job registry
   * engine
   * interval controller
   * event controller
   * observer controller
   * discover controller
   * runtime controller
5. Initializes context bag `this.ctx`.
6. Sets instance version marker at `this.VERSION`.

Constructor non-goals:

* no DOM scan
* no event or interval activation
* no observer activation

---

## Runtime Composition

A constructed instance exposes controller/runtime surfaces including:

* `jobs`
* `engine`
* `discover`
* `observer`
* `events`
* `intervals`
* `runtime`
* `expr`
* `ctx`

Subsystems are controller-owned; orchestration remains centralized in the
ActiveTags class lifecycle.

---

## `start()` Contract

`start()` activates runtime behavior in deterministic order:

1. Resolve and validate environment document/body.
2. Run initial discovery scan (`discover.scan()`).
3. Start observer when `boot.observeDom` is enabled.
4. Register intervals and events for current jobs.
5. Conditionally enable intervals/events by boot flags.
6. Run startup autorun through the engine wait-aware pulse path.

Side effects:

* may register jobs from DOM discovery
* may attach observer/event listeners
* may activate interval scheduling
* may execute queued work during final pulse
* may leave the engine wake coordinator armed when timed waits are active

Error behavior:

* throws when runtime document/body is unavailable

---

## Traits and Public Surface Policy

Traits attached via `applyMixins` are reserved for stateless API-surface helpers.

Trait modules should not own runtime lifecycle concerns. Stateful/lifecycle code
belongs in explicit controllers.

Current mixins:

* job helper trait
* engine helper trait

---

## Version Contract

Class-level and instance-level version markers are both exposed:

* `ActiveTags.VERSION`
* `AT.VERSION` on each instance

Both derive from `src/version.js`.

---

## Invariants

After successful construction:

* config snapshot exists at `this.conf`
* required dependencies/services have been asserted
* all runtime controllers are instantiated
* engine wait coordinator exists at `AT.engine.wake`
* instance can safely proceed to `start()`

After successful `start()`:

* discovery and trigger registration executed at least once
* boot gates have been applied
* engine has been drained at the end of startup
