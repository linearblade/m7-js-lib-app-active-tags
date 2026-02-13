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

---

## See also

* [Introduction](./usage/INTRODUCTION.md)
* [Configuration Model](./usage/CONFIGURATION.md)
* [Runtime Lifecycle](./usage/RUNTIME_LIFECYCLE.md)
* [Builtins & Operations](./usage/OPERATIONS_BUILTINS.md)
* [System Overview](./architecture/SYSTEM_OVERVIEW.md)
* [What Makes ActiveTags Different](./WHAT_MAKES_US_DIFFERENT.md)
* [README](../README.md)
