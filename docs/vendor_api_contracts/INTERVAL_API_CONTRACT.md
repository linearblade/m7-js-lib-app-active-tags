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
