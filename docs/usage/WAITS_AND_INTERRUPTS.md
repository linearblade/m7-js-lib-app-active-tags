# Waits & Interrupts — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents how to pause a pipeline with `wait`, how timed waits resume, and how to manually interrupt/resume a waiting ticket.

Primary source files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/Wake.js](../../src/class/engine/Wake.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)
* [../../src/class/engine/vm/OP.js](../../src/class/engine/vm/OP.js)

---

## 1) Mental model

A pipeline stage can pause the current ticket by returning a `wait` result.

When that happens:

* the ticket stays alive
* the ticket moves to `wait` state
* remaining pipeline stages do not run yet
* resume happens later, either:
  * automatically, after a timed wait expires
  * manually, after some external code unlocks the ticket

Important execution helpers:

* `AT.engine.drain(...)`
  runs work until idle, but does not refresh wait scheduling
* `AT.engine.pulse(...)`
  runs `drain(...)`, then refreshes the wait coordinator
* `AT.engine.wake`
  the wait coordinator used internally by `pulse()`

For user code, `pulse()` is usually the right entry point.

---

## 2) Returning a wait from a handler

You can return an explicit wait result:

```js
function pauseOneSecond() {
  return {
    status: "wait",
    await: {
      type: "delay",
      until: Date.now() + 1000,
      token: "delay-1"
    }
  };
}
```

Legacy shorthand is also supported:

```js
function pauseOneSecond() {
  return {
    wait: true,
    await: {
      type: "delay",
      until: Date.now() + 1000,
      token: "delay-1"
    }
  };
}
```

Recognized wait-handle fields:

* `until`
  epoch milliseconds used for timed resume
* `token`
  optional guard for later `unlock(...)` / `unlockTicket(...)`

Other fields are allowed and ride along as metadata.

---

## 3) Timed wait setup

Timed waits are the easiest form.
Return `wait` with an `until` timestamp, then execute the ticket with `pulse()`.

```js
function waitMs(ms) {
  return function waitStep() {
    return {
      status: "wait",
      await: {
        type: "delay",
        until: Date.now() + ms,
        token: `delay:${ms}`
      }
    };
  };
}

function finishStep({ buffer }) {
  buffer.set("done", true);
  return true;
}

const jobDef = {
  pipelines: {
    delayed_save: {
      run: [
        waitMs(1500),
        finishStep
      ]
    }
  }
};
```

Manual execution:

```js
const job = AT.toJob("demo-job");
const ticket = AT.engine.enqueue(job, "delayed_save", {
  inputs: { reason: "manual" },
  meta: { source: "console" }
});

await AT.engine.pulse({ ticket });
```

What `pulse()` does here:

1. runs the ticket until the stage returns `wait`
2. stores the wait metadata on the active ticket
3. asks `AT.engine.wake` to schedule the next resume
4. resumes the ticket automatically when `until` has passed

---

## 4) Manual interrupt / external resume

If you omit `until`, the ticket waits forever until you unlock it.

Example handler:

```js
function waitForSignal({ ticket }) {
  return {
    status: "wait",
    await: {
      type: "signal",
      token: `signal:${ticket.id}`
    }
  };
}
```

Later, from some other event or integration:

```js
const ticket = AT.engine.getTicketByJob("demo-job", "default");

AT.engine.unlockTicket(ticket.id, ticket.lock.token);
await AT.engine.pulse({ ticket });
```

If you do not want to target one ticket directly, this is also valid:

```js
AT.engine.unlock("demo-job", "default", token);
AT.engine.wake.refresh();
```

Use cases for manual resume:

* a click confirms a pending flow
* a websocket or SSE message arrives
* another job decides the parked ticket may continue
* a test harness wants exact step-by-step control

---

## 5) Interrupt patterns

Common patterns:

* Timed delay:
  return `wait` with `until`
* Explicit signal:
  return `wait` with `token`, unlock later
* Protected resume:
  include a `token` and require that same token on unlock

Useful helpers:

* `AT.engine.getTicketByJob(jobLike, key?)`
  find the active ticket you want to inspect or resume
* `AT.engine.unlockTicket(ticketId, token?)`
  clear the wait/lock on one specific ticket
* `AT.engine.unlock(jobLike, key, token?)`
  clear the wait/lock through the `(job, pipelineKey)` alias
* `AT.engine.pulse(...)`
  resume work and refresh wait scheduling

---

## 6) Choosing `pulse()` vs `drain()`

Use `pulse()` when:

* the ticket may return `wait`
* you want timed waits to resume automatically
* you are manually resuming a waiting ticket

Use `drain()` when:

* you explicitly want the lower-level execution loop only
* you do not want wait timers refreshed as part of that call
* you are doing tight internal control where wake scheduling is handled separately

---

## See also

* [Pipeline Handlers (User Code)](./PIPELINE_HANDLERS.md)
* [Pipelines](./PIPELINES.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [AT.engine API reference](../api/reference/AT_ENGINE.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
