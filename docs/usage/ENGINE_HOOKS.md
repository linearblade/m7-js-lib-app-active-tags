# Event Hooks For The Engine — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents Engine lifecycle hooks and their payload contracts.

Primary source files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/TickResponse.js](../../src/class/engine/TickResponse.js)
* [../../src/class/engine/EngineManager.js](../../src/class/engine/EngineManager.js)
* [../../src/class/engine/testHooks.js](../../src/class/engine/testHooks.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## 1) Hook names

Canonical hook keys:

* `onEnqueue`
* `onDequeue`
* `onStage`
* `onComplete`
* `onError`
* `onTicketDone`

These are defined by `HOOKS` in `helpers.js`.

---

## 2) Where to configure hooks

Hooks are configured in top-level ActiveTags config under `engine.hooks`.

Example:

```js
const AT = new ActiveTags(lib, {
  engine: {
    hooks: {
      onStage(trace) {
        console.log("stage", trace);
      },
      onTicketDone(trace) {
        console.log("done", trace.summary);
      }
    }
  }
});
```

Behavior notes from schema compile:

* `engine.hooks: true` -> uses built-in `testHooks`.
* `engine.hooks: false | null | undefined` -> disables hooks.
* `engine.hooks: { ... }` -> function map (non-function values are filtered out).

---

## 3) Payload contracts

Important: hook payloads are not all the same shape.

### `onEnqueue` payload

`onEnqueue` is emitted by `EngineManager.enqueue(...)` and receives:

```js
{ job, ticket }
```

### Tick-emitted hook payload

`onDequeue`, `onStage`, `onComplete`, `onError`, and `onTicketDone` are emitted by `Tick._emitHook(...)` and all receive the same trace shape from `TickResponse._makeTickTrace(...)`:

```js
{
  didWork,
  jobId,
  ticketId,
  pipelineKey,
  return_status,
  stage,      // { phase, stageIndex, op, opLabel, step } | null
  res,        // StageResult-like payload
  result,     // alias of res (back-compat)
  terminal,
  summary,    // terminal summary for complete/error; otherwise null
  ok,
  waiting,
  complete,
  error,
  reason,
  locked,
  missingJob,
  empty
}
```

---

## 4) Emit timing

Hook emission points:

* `onEnqueue`:
  * emitted when a new ticket is enqueued in `EngineManager.enqueue(...)`
* `onDequeue`:
  * emitted when a queued ticket is promoted to active in Tick
* `onStage`:
  * emitted after each VM step (including terminal-transition steps)
* `onComplete`:
  * emitted on terminal complete
* `onError`:
  * emitted on terminal error
* `onTicketDone`:
  * emitted on both terminal complete and terminal error

`onTicketDone` is the best "always-finally" hook.

---

## 5) Terminal summary contract

For terminal hooks (`onComplete`, `onError`, `onTicketDone`), `trace.summary` contains:

```js
{
  state,         // "complete" | "error"
  phase,         // "run" | "error"
  handled,       // true if recovered through error-phase handling
  pipelineKey,
  originalError, // ticket.errorInfo when available
  error,         // terminal error object for error state
  res            // raw StageResult-like object
}
```

---

## 6) Minimal production pattern

```js
engine: {
  hooks: {
    onEnqueue: ({ job, ticket }) => {
      // enqueue-only payload shape
    },
    onTicketDone: (trace) => {
      // unified terminal trace shape
      if (trace.error) {
        // report failure
      }
    }
  }
}
```

---

## See also

* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Pipelines](./PIPELINES.md)
* [Pipeline Handlers (User Code)](./PIPELINE_HANDLERS.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)

