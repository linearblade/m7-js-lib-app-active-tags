# Builtins & Operations — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page explains how to call builtins from pipeline stages and how builtin lookup works with user handlers.

Primary source files:

* [../../src/builtins/index.js](../../src/builtins/index.js)
* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/engine/vm/Validate.js](../../src/class/engine/vm/Validate.js)
* [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)
* [../../src/at_config/Schema.js](../../src/at_config/Schema.js)

---

## 1) Calling a builtin in a pipeline step

Builtins are normal operation names resolved by the VM at runtime.

You can call them in string form:

```js
{
  pipeline: {
    run: "form.collect form.submit",
    error: "error.dump"
  }
}
```

Or in object form:

```js
{
  pipelines: {
    save: {
      run: [
        { op: "target.find", args: [".status"] },
        { op: "target.patch", args: { textContent: "Saved" } }
      ],
      error: [{ op: "error.dump", args: { console: true } }]
    }
  }
}
```

---

## 2) Explicit builtin marker (`@`)

If you want a step to resolve as builtin-only, prefix with `@`:

```js
{
  pipeline: {
    run: [
      "@e.find:.message",
      "@target.patch"
    ],
    error: ["@error.dump"]
  }
}
```

Equivalent object form:

```js
{ op: "target.patch", builtin: true, args: { className: "is-active" } }
```

When `builtin: true` (or `@` is used), the VM does strict builtin lookup for that step.

---

## 3) Lookup policy for non-explicit steps

For steps without explicit builtin markers, lookup follows:

* `AT.conf.engine.opResolution.order`
* only when `AT.conf.engine.opResolution.auto === true`

Default policy:

```js
engine: {
  opResolution: {
    order: ["user", "lib", "builtin"],
    auto: true
  }
}
```

Resolution behavior:

* Explicit builtin (`@foo` or `builtin: true`) -> builtin-only lookup.
* Non-explicit + `auto: true` -> lookup in configured `order`.
* Non-explicit + `auto: false` -> user-handler lookup only.

If lookup fails, the stage is treated as unknown op and follows normal pipeline error behavior.

Warning:
Tightening non-explicit lookup (especially with `auto: false`) can be useful for performance and deterministic resolution, but review the strict posture guidance below before enabling it broadly.

### Strict no-fallback posture (recommended when hardening lookup rules)

If you want strict operation resolution without builtin fallback for non-explicit steps:

* set `engine.opResolution.auto: false`
* keep `engine.opResolution.order` user-first (for example `["user", "lib", "builtin"]`, same posture as defaults in `DEFAULT_CONFIG.js`)

In strict mode, pair this with engine error hooks so failures are visible.
Use `engine.hooks.onError` (exact key from `testHooks.js`) and ideally `onTicketDone` as a terminal safety net.

Example:

```js
{
  engine: {
    opResolution: {
      order: ["user", "lib", "builtin"],
      auto: false
    },
    hooks: {
      onError: ({ summary }) => {
        console.error("[AT][strict-op-resolution][error]", summary?.error || summary);
      },
      onTicketDone: ({ summary }) => {
        if (summary?.state === "error") {
          console.warn("[AT][strict-op-resolution][done:error]", summary);
        }
      }
    }
  }
}
```

If hooks are disabled and your error path is not instrumented, failures can appear silent by configuration.

---

## 4) Builtin catalog (current)

Root export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

Available builtin operations:

* `confirm`
* `form.collect`
* `form.prepare`
* `form.submit`
* `form.headers`
* `dom.attempt`
* `error.dump`
* `error.fail`
* `buffer.set`
* `buffer.get`
* `buffer.clear`
* `buffer.traverse`
* `buffer.assert`
* `target.patch`
* `target.reset`
* `target.set`
* `target.propGet`
* `target.propSet`
* `target.fromBuffer`
* `target.toBuffer`
* `target.closest`
* `target.find`
* `target.parent`
* `target.child`
* `e.reset`
* `e.self`
* `e.find`
* `e.closest`
* `e.parent`
* `e.child`
* `http.send`

Family source folders/files:

* Form: [../../src/builtins/form/](../../src/builtins/form/)
* DOM: [../../src/builtins/dom/](../../src/builtins/dom/)
* Error: [../../src/builtins/error/](../../src/builtins/error/)
* Buffer: [../../src/builtins/buffer/index.js](../../src/builtins/buffer/index.js)
* Target: [../../src/builtins/target/index.js](../../src/builtins/target/index.js)
* E: [../../src/builtins/e/index.js](../../src/builtins/e/index.js)
* HTTP: [../../src/builtins/http/httpSend.js](../../src/builtins/http/httpSend.js)
* Confirm: [../../src/builtins/confirm.js](../../src/builtins/confirm.js)
* HTTP send guide: [./HTTP_SEND.md](./HTTP_SEND.md)
* Builtins reference (module/function): [./builtins/INDEX.md](./builtins/INDEX.md)

---

## 5) Practical usage patterns

### Targeted DOM update from current job root

```js
{
  pipeline: {
    run: [
      "@e.find:.save-status",
      { op: "@target.patch", args: { textContent: "Saved", className: "ok" } }
    ]
  }
}
```

### Buffer path traversal before a user handler

```js
{
  pipelines: {
    submit: {
      run: [
        "@form.collect",
        "@form.submit",
        { op: "@buffer.traverse", args: { path: "data.user.id" } },
        "myApp.handleUserId"
      ],
      error: ["@error.dump"]
    }
  }
}
```

### Request headers staged for transport

```js
{
  pipeline: {
    run: [
      { op: "@form.headers", args: { headers: { "X-CSRF": "${config:csrf}" } } },
      "@form.submit"
    ]
  }
}
```

### Read target prop and write into DSL destination

```js
{
  pipeline: {
    run: [
      "@e.find:#profile",
      // compact positional form
      "target.propGet:data-user-id:window:ws.user.id",
      // equivalent explicit object form
      { op: "target.propSet", args: { prop: "data-last-read", value: "1" } }
    ]
  }
}
```

---

## 6) Engine config for builtins

`engine.builtins` is boolish + mergeable:

* `true` -> use default ActiveTags builtins.
* `false` or `null` -> disable builtins.
* object -> merge over defaults (functions-only surface is compiled).

Example override:

```js
{
  engine: {
    builtins: {
      target: {
        // overrides default target.patch
        patch: async ({ lib, ticket }) => {
          lib.dom.set(ticket.target, "data-patched", "1");
          return { status: "ok" };
        }
      }
    }
  }
}
```

---

## 7) Stage result contract

Builtin operations should return StageResult-like outputs the VM can normalize:

* `ok`
* `wait`
* `error`
* `complete`

Helper contracts:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## 8) Notes and caveats

* String op shorthand uses compact parsing (`op:arg1,arg2`) and splits args on commas.
* For structured args, prefer object step form (`{ op, args: {...} }`).
* `target.patch` is target-driven; resolve target first (`e.find`/`target.find`/`target.reset`).
* `e.*` always resolves from `job.e` (root) and writes result to `ticket.target`.
* `target.propGet` reads from current target and can optionally write to unresolved destination DSL expression (`dst`), for example `window:ws.user.id`.
* `target.propGet` also mirrors the read value into `buffer` when available.
* `dom.attempt` is a strict wrapper around `lib.dom.attempt(source, true)` and writes the resolved node to `ticket.target`.

---

## Related

* [Pipelines](./PIPELINES.md)
* [Pipeline Handlers](./PIPELINE_HANDLERS.md)
* [Configuration Model](./CONFIGURATION.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [../architecture/subsystems/BUILTINS_BUFFER_TARGET.md](../architecture/subsystems/BUILTINS_BUFFER_TARGET.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
