# Documentation TODO Checklist

- [x] Setting up pipelines (dedicated page)
- [x] Setting up intervals (dedicated page)
- [x] Setting up events (dedicated page)
- [x] Setting up requests (dedicated page)
- [x] How to use `require`
- [ ] How to use builtins
- [x] `autorun` and `enabled`
- [x] Pipeline handlers (user code)
- [x] Event hooks for the engine
- [x] Reviewing logs

## Buglist

- [ ] Builtins audit pass: double-check builtin implementations for contract mismatches and incorrect behavior.
- [ ] Evaluate explicit builtin step specifier syntax (for example `@builtin.path` or `$builtin.path`) to make builtin calls visually distinct from user function steps.
  If adopted, define parser/runtime compatibility rules and migration posture for existing unprefixed builtin ops.
- [x] Pipeline DSL accepts inline function entries for single "stringlike" steps (for example `dummyLogin`) in addition to string tokens and object records.
- [x] Added `target` to the top-level run-handler call shape so handlers can access current target directly.
  Runtime now also provides `e` (job root element) alongside `target`.
- [ ] Add an absolute element-path builtin family (for example `e.find`, `e.closest`, etc.) that mirrors `target.*` but always resolves from the source/root element so we do not need extra target reset steps.
- [ ] Revisit `dom.patch` naming and contract:
  keep compatibility for now, but either rename to a clearer modern API or rework behavior/documentation so it is not treated as the long-term DOM write primitive.
- [ ] Add a `dom.set` builtin (for example `dom.set:attr,val` or object args) to support direct attribute/property writes without requiring custom user functions for simple UI updates.
- [x] Require-gating policy harmonization: `IntervalController.conditionalOn(...)` and `EventController.conditionalOn(...)` provide require-gated activation paths, while legacy direct `on()` remains intentionally manual/ungated for user-initiated control.
  Compatibility posture documented in usage docs (`REQUIRE.md`) and controller API references.
- [x] Login/event drain policy: boot startup now performs conditional interval/event scheduling followed by a final `engine.drain()` so event-driven handlers are installed without manual tutorial drain hooks.
- [x] Event parity with interval conditional gating: implemented `EventController.conditionalOn(...)` with require-gated synthetic enqueue path mirroring `IntervalController.conditionalOn(...)`.
- [x] Event-trigger unlock propagation without full queue drain: delegated event handlers now perform a targeted `engine.drain({ ticket })` pass followed by bounded scheduler-filtered drain (`requireJob`) so newly unlocked dependents can start without draining unrelated work.
- [x] Extend enqueue contract to report whether the returned ticket was newly created or deduped/reused.
  Implemented optional enqueue metadata return via `opts.returnMeta`:
  `{ ticket, created }` (with backward-compatible default plain `Ticket` return).
- [x] Extend `AT.enqueueAll(...)` contract to support enqueue metadata passthrough.
  `enqueueAll(opts)` now accepts `opts.returnMeta` and returns `{ count, entries }` while preserving default numeric return when not requested.
- [ ] Investigate activation idempotency risk for synthetic internal jobs used by interval/event conditional startup.
  Potential issue: repeated interval/event activation flows may enqueue/reuse internal trigger jobs in ways that accidentally re-run installs (`on(...)`) when callers re-invoke startup/activation paths.
- [x] Engine context now passes main AT/root runtime context through engine/vm/handler surfaces to avoid global callbacks back to ActiveTags.
  Agreed handler call shape target in `VM.js`:
  `v.fn({ job, lib, args, buffer: ticket.buffer, inputs: ticket.inputs, trigger, target: ticket.target, e: job.e, ticket, ctx, AT, step })`
  Context model note:
  keep global `AT.ctx` separate from per-run `ctx` used by `tick`/`drain`.
- [ ] Add a dependency bootstrap/install script for lib 1.0-based examples/runtime setup so dependency loading does not rely on manual global wiring.
- [ ] Audit `auto.js` dependency modules that currently assume global `lib`; either refactor to explicit injection/import or add a controlled compatibility bootstrap.
- [ ] Audit `m7-js-lib` for unintended global/window mutation (for example assigning `window.lib`), and document the expected global contract.
- [ ] Guard symbolic handler function lookup when `lib` is not globally assigned (`window.lib` absent) so pipeline handler calls do not fail due to out-of-scope globals.
  Add lookup note/implementation check: use `lib.func.get(...)` resolution across both env-root symbols and internal lib function registry.
- [x] Runtime internal job configure race resolved for conditional paths: `RuntimeController.createInternalJob(...)` now awaits async `job.configureFrom(...)` before return.
  Interval and event conditional enqueue paths now await `createInternalJob(...)` before enqueueing synthetic tickets.

## Low Priority

- [ ] Internal job name normalization note: `RuntimeController.createInternalJob(...)` currently mutates `rec.name` (sets it to internal identifier) before `configureFrom(...)`.
  This prevents configuration build from overwriting internal job naming with `"none given"` when record name is empty.
  It is internal and non-problematic for now; cleanup is likely straightforward but currently paperwork-heavy.
- [ ] Roll up `trait_job.js` (`toJob`) into `ActiveTags.js` and remove trait indirection for this surface.
- [ ] Roll up remaining trait responsibilities into runtime controller surfaces where behavior is runtime-oriented.
- [ ] Evaluate runtime-start boundary: consider `runtime.start(...)` as lifecycle entry instead of main `ActiveTags.start()` owning startup orchestration directly.
- [ ] Evaluate controller initialization ownership: move initialization/wiring currently done in `ActiveTags` constructor into controller-owned init flows where practical.
- [ ] Reorganize source layout: `src/class/` naming no longer matches current architecture posture; either split by subsystem with clearer boundaries or collapse `class/` into `src/`.
