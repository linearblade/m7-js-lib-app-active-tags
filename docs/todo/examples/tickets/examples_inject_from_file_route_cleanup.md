# Inject From File Route Cleanup

[TODO index](../../INDEX.md) | [examples open](../OPEN.md) | [examples done](../DONE.md)

## Goal
Make file-request + DOM-inject flows concise, reliable, and builtin-driven.

## Current Example
- `examples/inject/fromFile/injectFromFile.html`
- `examples/inject/fromFile/injectFromFile.js`
- `examples/inject/fromFile/inject-file.js`
- `examples/inject/fromFile/fragment.html`

## Action List

- [ ] Simplify HTTP request construction for local file fetches (ideally a one-liner op/builtin route).
  Pointers:
  - `src/builtins/http/httpSend.js`
  - `src/builtins/http/index.js`
  - `src/builtins/index.js`
  - `examples/inject/fromFile/inject-file.js`
  - `../m7-js-lib/src/lib/request/http.js`

- [ ] Investigate autorun startup path; verify `AT.start()` reliably enqueues/runs autorun jobs without manual `enqueueAll()` + `engine.drain()`.
  Pointers:
  - `src/ActiveTags.js`
  - `src/traits/engine.js`
  - `src/class/job/config/schema/Master.js`
  - `examples/inject/fromFile/injectFromFile.js`
  - `examples/inject/fromFile/inject-file.js`

- [ ] Replace custom injection helper with builtin route (`target.propSet` / `dom.*`) or add missing DOM toolkit builtin(s).
  Pointers:
  - `examples/inject/fromFile/inject-file.js`
  - `src/builtins/target/index.js`
  - `src/builtins/dom/index.js`
  - `src/builtins/index.js`

- [ ] Explore fluent single-instruction request+inject syntax and execution model.
  Candidate targets:
  - `run: [ "@requestFile:somefile.html", "@dom.set:${job:inline}" ]`
  - `run: [ "@requestFile:somefile,pointer_to_location" ]`
  Pointers:
  - `src/class/expressions/ExpressionResolver.js`
  - `src/class/engine/vm/Validate.js`
  - `src/class/expressions/dispatch.js`
  - `src/builtins/http/httpSend.js`
  - `docs/usage/PIPELINES.md`
