Perfect — this is exactly the right moment to zoom back out.

Let’s **re-establish the top-level configuration model**, now that the **Pipeline block is locked**. I’ll keep this tight, principled, and faithful to how v098 actually behaved.

---

# ActiveTags Top-Level Configuration (v1)

This object represents **one ActiveTag entity (Job)**.
It is the **merged result** of:

* inline `data-*` attributes
* external config referenced by `data-config`
* defaults applied by the engine

> Pipelines live *inside* this object, but this object is about **job lifecycle and behavior**, not execution steps.

---

## Canonical shape

```ts
type ActiveTagConfig = {
  /** Enable / disable job behavior */
  enable?: EnableConfig;

  /** Request defaults (used by request.submit) */
  request?: RequestDefaults;

  /** UI / UX defaults */
  ui?: UiConfig;

  /** Execution pipelines */
  pipelines?: PipelineMap;

  /** Autorun + lifecycle */
  run?: RunConfig;

  /** Interval / scheduling (optional) */
  interval?: IntervalConfig;

  /** Requirements / dependencies */
  require?: string[] | string;

  /** Arbitrary consumer data (not interpreted by engine) */
  meta?: Record<string, any>;
};
```

---

## 1. `enable` — hard gates

This answers: **“is this job allowed to do anything?”**

```ts
type EnableConfig = {
  /** Master switch. Default: true */
  enabled?: boolean;

  /** Allow autorun pipelines. Default: true */
  autorun?: boolean;

  /** Allow interval execution. Default: true */
  interval?: boolean;
};
```

### v098 mapping

* `enable.autorun === false` → job skipped in `runAll()`
* Missing `enable` → treated as enabled

📌 **Rule**:
If `enabled === false`, the job is inert — no autorun, no submit, no interval.

---

## 2. `request` — request defaults (NOT execution)

This is **data**, not behavior.

```ts
type RequestDefaults = {
  url?: string;
  method?: string;
  encoding?: "urlencoded" | "json" | "formdata" | "raw";
  body?: any;
  headers?: Record<string, string>;
  credentials?: boolean;
  timeoutMs?: number;
  transport?: string;
};
```

### Important rule

`request` does **nothing by itself**.

It is **only consumed** by:

```json
{ "op": "request.submit" }
```

This cleanly separates:

* *what a request looks like*
* from *when a request is sent*

(v098 mixed these; v1 does not.)

---

## 3. `ui` — presentation hints

```ts
type UiConfig = {
  loadingText?: string;
  confirmText?: string;
  alertTarget?: TargetRef;
};
```

### v098 mapping

* `loading: "submitting request"` → `ui.loadingText`
* `data-confirm` → overridden or defaulted by `ui.confirmText`

📌 These are **hints**, not behavior.
Behavior lives in pipelines (`ui.confirm`, `ui.alert` ops).

---

## 4. `pipelines` — execution logic (locked)

Already finalized.

```ts
pipelines: {
  [name: string]: PipelineBlock
}
```

Rules:

* Pipeline names are **consumer-defined**
* Pipelines are only executed when:

  * autorun fires, or
  * a trigger explicitly requests them

---

## 5. `run` — autorun & defaults

This answers: **“what runs automatically, and when?”**

```ts
type RunConfig = {
  /** Default pipeline to run when triggered without explicit pipeline */
  defaultPipeline?: string;

  /** Pipeline to run on job registration (autorun) */
  autorunPipeline?: string;

  /** Allow multiple concurrent runs */
  allowConcurrent?: boolean;
};
```

### v098 mapping

* Autorun logic lived in `runAll()` + `enable.autorun`
* Default pipeline was implicitly `"response"` or `"initial"`

📌 **Rule**:

* If autorun enabled and `autorunPipeline` exists → run it once after registration
* If a trigger fires without specifying a pipeline → use `defaultPipeline`

---

## 6. `interval` — scheduled execution

```ts
type IntervalConfig = {
  /** Interval delay in ms */
  repeat: number;

  /** Optional max runs (0 or omitted = infinite) */
  max?: number;

  /** Pipeline to run on each tick */
  pipeline?: string;

  /** Start automatically */
  autorun?: boolean;
};
```

### v098 mapping

* `data-interval-*`
* `startInterval()` + `intervalUnlock`

📌 Intervals **run pipelines**, not stacks or raw stages.

---

## 7. `require` — dependencies

```ts
require?: string[] | string;
```

Semantics:

* Job will not autorun or start intervals until all named jobs are complete.

Direct lift from:

```js
meetsRequirements(job)
```

in v098.

---

## 8. `meta` — consumer-owned data

```ts
meta?: Record<string, any>;
```

* Never interpreted by engine
* Safe place for app-specific data

---

## Example: full top-level config (clean & complete)

```json
{
  "enable": {
    "enabled": true,
    "autorun": false
  },

  "request": {
    "url": "/api/bucket/delete",
    "method": "POST"
  },

  "ui": {
    "loadingText": "Deleting bucket…"
  },

  "run": {
    "defaultPipeline": "initial"
  },

  "pipelines": {
    "initial": {
      "run": [
        { "op": "ui.confirm", "message": "Are you sure?" },
        { "op": "request.submit" },
        { "op": "response.json" },
        { "op": "call", "name": "app.bucket.delete" }
      ],
      "onError": [
        { "op": "ui.alert", "mode": "buffer" }
      ]
    }
  }
}
```

---

## Why this structure is *right*

* **Separation of concerns** is now clean:

  * config = data
  * pipelines = behavior
* v098 behavior is preserved
* consumers can reason about it without reading engine code
* schema + tooling + validation become trivial

---

### Next logical step (no pressure)

The *very next* thing, if you want to keep momentum, would be to:

* lock the **ActiveTagConfig JSON Schema v1**, using the Pipeline schema as a component

That would fully freeze the public contract and let implementation proceed freely.

Say the word and I’ll emit it.



Yep — that’s the right move. In v1, **`request` should not be a single object**; it should be a **request catalog** (a “bucket”) so pipelines can submit different requests by name.

## Proposed v1 rule

* Top-level **`requests`** is the canonical request bucket (map).
* For compatibility / convenience:

  * if the user provides a single `request` object, treat it as `requests.default`
  * if the user provides a `requests` bucket, prefer it
  * (optional) allow `request` to be an alias to the bucket when it’s already a map — but I’d rather keep the keys distinct to avoid ambiguity.

## New top-level shape

### A) Multi-request (recommended)

```json
{
  "enable": { "enabled": true, "autorun": false },

  "requests": {
    "deleteBucket": {
      "url": "/api/bucket/delete",
      "method": "POST"
    },
    "refreshBuckets": {
      "url": "/api/bucket/search",
      "method": "POST",
      "encoding": "json",
      "body": { "q": "${ws.query}" }
    }
  },

  "ui": { "loadingText": "Deleting bucket…" },

  "run": { "defaultPipeline": "initial" },

  "pipelines": {
    "initial": {
      "run": [
        { "op": "ui.confirm", "message": "Are you sure?" },
        { "op": "request.submit", "request": { "ref": "deleteBucket" } },
        { "op": "response.json" },
        { "op": "call", "name": "app.bucket.delete" }
      ],
      "onError": [{ "op": "ui.alert", "mode": "buffer" }]
    }
  }
}
```

## The key addition: request references

### `request.submit` now supports `ref`

Instead of embedding the whole request each time, you can reference one:

```json
{ "op": "request.submit", "request": { "ref": "deleteBucket" } }
```

### RequestRef shape

```ts
type RequestRef = { ref: string }  // "deleteBucket"
```

And `request.submit` resolves in this order:

1. op inline override fields (if any)
2. request bucket entry (`requests[ref]`)
3. job defaults (optional)
4. element attrs (action/method/enctype)

So you can still do:

```json
{ "op": "request.submit", "request": { "ref": "deleteBucket", "body": { "id": "${form:id}" } } }
```

## B) Single request (compat mode)

If the user wants the old “single request”, they can still write:

```json
{
  "request": { "url": "/api/bucket/delete", "method": "POST" }
}
```

Engine normalization:

* becomes:

```json
{
  "requests": { "default": { "url": "...", "method": "POST" } }
}
```

* and `{ op:"request.submit" }` uses `requests.default` implicitly.

## Whether `request` can “be the bucket”

I’d avoid overloading `request` to sometimes mean object and sometimes map. It makes schema + human reading worse.

Cleaner:

* **`requests`** = bucket (always a map)
* **`request`** = legacy single spec (always a spec)

Normalization handles the rest.

---

### Minimal changes to your example

Your earlier config becomes:

```json
{
  "enable": { "enabled": true, "autorun": false },

  "requests": {
    "default": { "url": "/api/bucket/delete", "method": "POST" }
  },

  "ui": { "loadingText": "Deleting bucket…" },
  "run": { "defaultPipeline": "initial" },

  "pipelines": {
    "initial": {
      "run": [
        { "op": "ui.confirm", "message": "Are you sure?" },
        { "op": "request.submit", "request": { "ref": "default" } },
        { "op": "response.json" },
        { "op": "call", "name": "app.bucket.delete" }
      ],
      "onError": [{ "op": "ui.alert", "mode": "buffer" }]
    }
  }
}
```

If you want, next I’ll lock the **schema changes** for this:

* add `requests` bucket
* add `RequestRef`
* update `request.submit` op to accept `{ref}` or inline spec



Yep — you can (and probably should) **roll almost all “ui” preflight behavior into the pipeline**, and treat element attributes like `data-confirm` as **trigger-level overrides**.

Here’s a clean, v1-consistent model that keeps things simple and powerful.

## 1) Move “loadingText” out of top-level UI and into pipeline ops

Instead of:

```json
"ui": { "loadingText": "Deleting bucket…" }
```

Do this in the pipeline:

```json
{
  "op": "ui.loading",
  "mode": "start",
  "text": "Deleting bucket…"
}
```

and then later:

```json
{ "op": "ui.loading", "mode": "stop" }
```

Why:

* It’s *behavior*, so it belongs in the pipeline.
* It becomes per-pipeline (initial/response/delete/etc).
* You can make it deterministic (start/stop always paired; onError can stop too).

### Where the data lives

Your engine can store UI state in a job-scoped env area, e.g.

* `job.env.ui.loading = { active, text, since }`
  or in `job.ws.ui...` if you prefer.

Either is fine; I’d keep it as `job.env` to separate engine state from consumer workspace.

## 2) Keep `data-confirm` as the initial gate, but formalize the precedence

You’re right: confirm is usually tied to the trigger, but you want a baseline in config.

So define:

### Top-level (baseline)

```json
"confirm": {
  "message": "Are you sure?"
}
```

### Trigger-level override (existing behavior)

* `data-confirm="..."` overrides baseline message for that trigger.
* If trigger has `data-confirm=""` (empty), treat as “no confirm”.

### Precedence rule

When running a pipeline for a trigger:

1. if trigger `data-confirm` exists → use it
2. else if config `confirm.message` exists → use it
3. else no confirm gate

And the confirm gate is always step 0 of the resolved pipeline.

## 3) How it looks in a pipeline (recommended)

Pipeline doesn’t need hardcoded text if you want baseline/trigger override. Make confirm read from env:

```json
{
  "pipelines": {
    "initial": {
      "run": [
        { "op": "ui.confirm", "message": "${env:confirm.message}" },
        { "op": "ui.loading", "mode": "start", "text": "${env:loading.text}" },

        { "op": "request.submit", "request": { "ref": "deleteBucket" } },
        { "op": "response.json" },
        { "op": "call", "name": "app.bucket.delete" },

        { "op": "ui.loading", "mode": "stop" }
      ],
      "onError": [
        { "op": "ui.loading", "mode": "stop" },
        { "op": "ui.alert", "mode": "buffer" }
      ]
    }
  }
}
```

Then at trigger time, your engine seeds:

* `job.env.confirm.message` from trigger or config
* `job.env.loading.text` from config/pipeline/trigger (your choice)

## 4) Minimal top-level config after this change

You can drop `ui.loadingText` entirely and replace with baseline knobs that feed env:

```json
{
  "confirm": { "message": "Are you sure?" },
  "env": {
    "loading": { "text": "Deleting bucket…" }
  }
}
```

Or, if you don’t want `env` user-facing yet, keep it as internal and allow:

```json
{
  "confirm": { "message": "Are you sure?" },
  "uiDefaults": { "loadingText": "Deleting bucket…" }
}
```

…but conceptually it’s still “seed env”.

## 5) What about “onsubmit” (pre-submit actions)?

Same approach: **onsubmit becomes a preflight pipeline** (or a built-in op).

Two clean options:

### Option A: a dedicated preflight pipeline

```json
"run": { "preflightPipeline": "preSubmit" },
"pipelines": {
  "preSubmit": {
    "run": [
      { "op": "call", "name": "app.validate" },
      { "op": "attr.transform", "map": { "data-state": "submitting" } }
    ]
  },
  "initial": { "...": "..." }
}
```

Engine rule:

* when a trigger fires `initial`, the engine runs `preSubmit` first.

### Option B: an op that runs a named pipeline

```json
{ "op": "pipeline.run", "name": "preSubmit" }
```

That keeps everything explicit and consumer-structured.

---

## Bottom line (locked behavior)

* **Loading UI belongs in pipeline**, not top-level UI config.
* **Confirm gate stays special** (trigger-first), but can fall back to **config baseline**.
* **Onsubmit becomes preflight pipeline** (or a `pipeline.run` call at the top).

If you want, next I’ll give you the *exact trigger-resolution algorithm* that builds:

* `selectedPipelineName`
* `env.confirm.message`
* `env.loading.text`
* and the final run list (`preflight + main`) without adding any new “magic.”
