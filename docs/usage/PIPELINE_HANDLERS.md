# Pipeline Handlers (User Code) — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents user-defined pipeline handlers (plain JavaScript functions used as pipeline steps).

Primary source files:

* [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)
* [../../src/class/engine/vm/OP.js](../../src/class/engine/vm/OP.js)
* [../../src/class/engine/vm/Validate.js](../../src/class/engine/vm/Validate.js)
* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)

---

## 1) Where handlers are used

You can place function references directly in pipeline `run`/`error` arrays.

Example:

```js
function doWork({ buffer }) {
  buffer.set({ status: 1, data: { ok: true } });
  return true;
}

export default {
  pipelines: {
    save: {
      run: [doWork, "buffer.traverse:data"],
      error: ["error.dump"]
    }
  }
};
```

---

## 2) Runtime call shape

When the VM executes a function step, the handler receives one object:

```js
{
  job,                 // current Job
  lib,                 // m7 lib instance
  args,                // materialized args for this step
  buffer,              // ticket.buffer
  inputs,              // ticket.inputs
  trigger,             // trigger element/event source when present
  target,              // ticket.target (current mutable target pointer)
  e,                   // effective root element for this stage
  ticket,              // current run ticket
  ctx,                 // per-run mutable context object
  AT,                  // owning ActiveTags instance
  step                 // raw pipeline step record
}
```

Notes:

* `ctx` is run-scoped and mutable (for example `ctx.error`).
* `AT.ctx` is global runtime/app context and is separate from per-run `ctx`.
* `target` is a convenience alias to `ticket.target`.
* For attached jobs, `e === job.e`.
* For headless jobs with no bound element, VM falls back to `AT.conf.env.document.body` for `e` and stage-local `job.e`.

---

## 3) Return value contract

Handlers may return:

* `true` / truthy scalar -> continue (`ok`)
* `false` / falsy scalar -> error
* StageResult-like object with explicit `status`:
  * `ok`
  * `wait`
  * `error`
  * `complete`

Legacy `wait` shorthand remains supported:

```js
return { wait: true, await: promiseLike };
```

For deterministic behavior, explicit StageResult objects are preferred for advanced flows.

---

## 4) Materialized args

`args` are resolved before your handler is called:

* Encapsulated expressions (for example `"${window:foo}"`) resolve to raw values.
* Template strings (for example `"hello ${window:name}"`) resolve to strings.

This allows handlers to receive real functions/objects/numbers when expressions point to them.

---

## 5) Practical example using `AT`

```js
function requireLoggedIn({ AT, ctx } = {}) {
  const header = AT && typeof AT.toJob === "function" ? AT.toJob("header") : null;
  if (!header) {
    ctx.error = "Header job unavailable.";
    return false;
  }
  return true;
}
```

This avoids relying on `window.AT`.

---

## 6) Handler guidelines

* Keep cross-job reads/writes in workspace (`job.ws`), not DOM text.
* Use `ctx` for transient run-state/error messaging.
* Prefer builtins for repetitive DOM/target operations.
* Use `AT` for runtime lookups (for example `AT.toJob(...)`) instead of globals.

---

## See also

* [Pipelines](./PIPELINES.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [v098 DSL Manual](./DSL_V098.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
