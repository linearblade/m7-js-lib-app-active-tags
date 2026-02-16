# Require Dependencies — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page explains how top-level job `require` works, including runtime gating behavior.

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)
* [../../src/class/engine/Scheduler.js](../../src/class/engine/Scheduler.js)
* [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)

---

## 1) What `require` means

`require` declares prerequisite jobs for a job.

A required job is considered satisfied only after it has completed at least one run:

* `dep.flags.hasRun === true`

Until then, tickets for the dependent job are not runnable.

---

## 2) Authoring forms

`require` accepts:

* space-delimited string
* array of refs

Examples:

```js
{
  name: "stock-form",
  require: "header auth"
}
```

```js
{
  name: "stock-form",
  require: ["header", "auth"]
}
```

Compiler normalization output is always an array:

```js
{
  require: ["header", "auth"]
}
```

Invalid non-empty types emit `W101_REQUIRE_INVALID` and normalize to `[]`.

---

## 3) How runtime enforces it

At enqueue time, runtime copies schema-level dependencies into each ticket:

* `ticket.require`

During scheduling, tickets are runnable only when each dependency resolves and has run.

Dependency checks are evaluated live through `JobRegistry.resolve(...)`, so refs may be:

* job id
* job name (if unique)
* element-bound refs or job-like refs

---

## 4) Events, intervals, and startup behavior

Current activation posture:

* `conditionalOn(...)` paths are require-gated (used by `AT.start()` boot flow).
* legacy direct `on(...)` activation remains manual and ungated by policy.
* This means manually turning on an interval/event via controller `on(...)` can still activate it even when its job has unmet `require` dependencies.
* Manual `off(...)` remains a direct runtime stop/uninstall path and is not blocked by `require`.

This keeps startup/dependency activation safe while preserving explicit manual control for direct callers.

Controller reference:

* [Intervals `on(jobLike, intervalName?)`](../api/reference/at-intervals/on.md)
* [Intervals `off(jobLike, intervalName?)`](../api/reference/at-intervals/off.md)
* [Events `on(jobLike, eventName?)`](../api/reference/at-events/on.md)
* [Events `off(jobLike, eventName?)`](../api/reference/at-events/off.md)

---

## 5) Unlock propagation after events

When an event pipeline runs, runtime now performs:

1. targeted drain for the event ticket
2. bounded scheduler-filtered drain using `requireJob`

That second pass allows newly unlocked dependent jobs to start without draining unrelated queued work.

API references:

* [Engine `tick({ ctx?, ticket?, requireJob? } = {})`](../api/reference/at-engine/tick.md)
* [Engine `drain({ max?, ticket?, requireJob?, ctx? } = {})`](../api/reference/at-engine/drain.md)

---

## 6) Practical pattern

Login/bootstrap job:

```js
{
  name: "header",
  pipeline: { run: ["dummy_login"] }
}
```

Dependent job:

```js
{
  name: "stock-form",
  require: "header",
  events: { buy_click: { event: "click", pipeline: "buy" } },
  intervals: { quote_tick: { repeat: 2000, pipeline: "quote_tick" } }
}
```

After `header` completes once, dependent tickets that require `header` can run.

---

## 7) Troubleshooting

If dependent work does not start:

* confirm required job ref resolves to the intended job
* confirm required job actually completed (not just enqueued)
* confirm no lock/wait state is preventing execution
* confirm dependency refs are unique enough (name collisions can be ambiguous)

---

## See also

* [Basics](./BASICS.md)
* [Top-Level Job Config](./TOP_LEVEL_CONFIG.md)
* [Events](./EVENTS.md)
* [Intervals](./INTERVALS.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
