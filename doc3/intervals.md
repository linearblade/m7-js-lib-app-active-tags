Good, this is the right moment to **lock the interval block properly**, because intervals in v098 are *real*, subtle, and slightly dangerous 😄 — and v1 should fix that without losing power.

Below is a **clean v1 definition** that is:

* faithful to what v098 actually does
* pipeline-native (no hidden stack magic)
* safe against clogging / overlap
* explicit about lifecycle

---

# Interval Block — v1 Definition

## What an interval *is* (fundamentally)

An **interval** is a **scheduler** attached to a job that:

* fires on a fixed cadence (`repeat`)
* conditionally executes a **pipeline**
* enforces **mutual exclusion** (no overlap unless allowed)
* can auto-stop on error or after `max` runs

In v1, an interval **does not execute stacks or stages**.
It executes **exactly one pipeline per tick**.

---

## Canonical shape

```ts
type IntervalBlock = {
  /** Enable / disable interval entirely */
  enabled?: boolean;        // default: true

  /** Delay between runs (ms). REQUIRED if enabled */
  repeat: number;

  /** Pipeline to run on each tick. REQUIRED */
  pipeline: string;

  /** Max executions (0 or undefined = infinite) */
  max?: number;

  /** Start automatically after job registration */
  autorun?: boolean;        // default: true

  /** What to do if the pipeline errors */
  onError?: "stop" | "continue"; // default: "stop"

  /** Allow overlapping runs */
  allowOverlap?: boolean;   // default: false

  /** Optional initial delay before first run */
  delay?: number;

  /** Optional metadata */
  meta?: Record<string, any>;
};
```

---

## Defaults (important)

If omitted:

```json
{
  "enabled": true,
  "autorun": true,
  "onError": "stop",
  "allowOverlap": false
}
```

These defaults deliberately **fix v098 pain points**.

---

## Execution semantics (this is the contract)

### State tracked per job (engine-owned)

```ts
job.intervalState = {
  running: boolean,
  count: number,
  timerId?: any
}
```

### On start

* If `enabled !== true` → do nothing
* If `autorun === true` → schedule interval
* If `delay` exists → first run delayed by `delay`, else by `repeat`

---

### On each tick

Pseudocode:

```js
if (!interval.enabled) return;

if (!interval.allowOverlap && job.intervalState.running) {
  return; // skip tick (v098 lock behavior)
}

job.intervalState.running = true;
job.intervalState.count += 1;

runPipeline(interval.pipeline)
  .then(() => {
    job.intervalState.running = false;
  })
  .catch(() => {
    job.intervalState.running = false;

    if (interval.onError === "stop") {
      stopInterval(job);
    }
  });

if (interval.max > 0 && job.intervalState.count >= interval.max) {
  stopInterval(job);
}
```

📌 **Key difference from v098**
No `intervalUnlock`, `intervalLock`, or stack mutation required.
The lock is *implicit and engine-managed*.

---

## Mapping from v098 behavior (explicit)

| v098 concept                | v1 equivalent                      |
| --------------------------- | ---------------------------------- |
| `ds.interval.repeat`        | `interval.repeat`                  |
| `ds.interval.max`           | `interval.max`                     |
| `interval.lock`             | `allowOverlap: false` (default)    |
| `intervalUnlock()`          | automatic on pipeline completion   |
| `intervalStart` stack stage | interval autorun                   |
| `intervalStop()`            | engine stop                        |
| “interval clogging” risk    | eliminated by lock + pipeline wait |

You explicitly noted clogging risk in comments — this fixes it.

---

## Example: periodic refresh

```json
{
  "interval": {
    "repeat": 5000,
    "pipeline": "refresh",
    "autorun": true,
    "onError": "continue"
  },

  "pipelines": {
    "refresh": {
      "run": [
        { "op": "request.submit", "request": { "ref": "refreshBuckets" } },
        { "op": "response.json" },
        { "op": "call", "name": "app.bucket.render" }
      ]
    }
  }
}
```

---

## Example: one-shot polling with cap

```json
{
  "interval": {
    "repeat": 1000,
    "max": 10,
    "pipeline": "pollStatus",
    "onError": "stop"
  }
}
```

---

## Explicit non-features (by design)

These are **intentionally removed** from v1:

* ❌ interval pipelines mutating stacks
* ❌ manual lock/unlock ops
* ❌ interval running multiple implicit stages
* ❌ interval restarting itself silently after errors

All of those caused complexity in v098.

---

## Why this is the *right* abstraction

* Intervals are **schedulers**, not workflows
* Pipelines are **workflows**
* The engine coordinates them deterministically

This matches how real schedulers (cron, job queues, game loops) work.

---

### If you want next

The natural next step is to:

* either lock the **Interval JSON Schema v1**
* or define how **multiple intervals per job** should work (I recommend *one interval per job* for v1, many jobs instead)

Say which direction you want to go.
