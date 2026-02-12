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
