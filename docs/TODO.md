# Documentation TODO Checklist

- [x] Setting up pipelines (dedicated page)
- [x] Setting up intervals (dedicated page)
- [x] Setting up events (dedicated page)
- [x] Setting up requests (dedicated page)
- [ ] How to use `require`
- [ ] How to use builtins
- [ ] `autorun` and `enable`
- [ ] Pipeline handlers (user code)
- [ ] Event hooks for the engine
- [ ] Reviewing logs

## Buglist

- [ ] Builtins audit pass: double-check builtin implementations for contract mismatches and incorrect behavior.
- [x] Pipeline DSL accepts inline function entries for single "stringlike" steps (for example `dummyLogin`) in addition to string tokens and object records.
- [ ] Add `target` to the top-level run-handler call shape (alongside values like `buffer`, `ticket`, etc.) so handlers can access current target directly.
- [ ] Add an absolute element-path builtin family (for example `e.find`, `e.closest`, etc.) that mirrors `target.*` but always resolves from the source/root element so we do not need extra target reset steps.
- [ ] Revisit `dom.patch` naming and contract:
  keep compatibility for now, but either rename to a clearer modern API or rework behavior/documentation so it is not treated as the long-term DOM write primitive.
- [ ] Add a `dom.set` builtin (for example `dom.set:attr,val` or object args) to support direct attribute/property writes without requiring custom user functions for simple UI updates.
- [ ] `require` currently gates autorun scheduling only; it does not gate interval/event-triggered enqueue paths.
  Investigate feasibility and design impact of extending `require` dependency gating to intervals and events.
- [ ] Engine context currently lacks direct main AT/root runtime context in handler/execution paths.
  Evaluate passing `AT` (or a start-time runtime context object) through engine/ticket/handler surfaces to remove the need for global callbacks back to ActiveTags.
  Agreed handler call shape target in `VM.js`:
  `v.fn({ job, lib, args, buffer: ticket.buffer, inputs: ticket.inputs, trigger, ticket, ctx, AT, step })`
  Context model note:
  keep global `AT.ctx` separate from per-run `ctx` used by `tick`/`drain`.
