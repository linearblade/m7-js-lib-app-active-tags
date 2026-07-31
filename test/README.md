# ActiveTags tests

Automated tests for ActiveTags. **All test code lives under `test/`** — production `src/` is not modified by this suite.

## Requirements

- Node.js 18+ (built-in `node:test` / `node:assert/strict`)
- Sibling monorepo layout:

```text
js/
  m7-js-lib/
  m7-js-lib-app-active-tags/   ← this repo
```

Engine tests construct ActiveTags with **stub CORE_SERVICES** and a **minimal fake document**. No browser, linkedom, or full primitive packages required.

## Run

From the project root:

```bash
# preferred (package.json)
npm test

# equivalent without npm
node --test test/**/*.test.js

# by area
npm run test:engine
npm run test:controllers
npm run test:builtins
npm run test:unit
npm run test:install

# watch
node --test --watch test/**/*.test.js

# release gate (includes this suite)
npm run release-check
# or: bash scripts/release-check.sh
```

## Layout

```text
test/
  README.md
  helpers/
    createEnv.js          # minimal env for engine-only tests
    createDom.js          # Element polyfill + live document + recording delegator
    createServices.js     # stub CORE_SERVICES on lib.service
    recordHooks.js        # structured engine hook capture
    createAT.js           # ActiveTags factory (+ services/env injection)
    index.js
  engine/
    enqueue-drain.test.js     # spine: drain, dedupe, re-entrancy, wait, errors
    cancel-lock.test.js       # cancel + lock/unlock policy
    cascade-tick.test.js      # single-step tick, multi-pipeline cascade, max
    inputs-workspace.test.js  # inputs, job.ws, falsy/complete returns
  controllers/
    discover-runtime.test.js          # sweep/scan, attachObservedNodes, dispose
    events-enqueue.test.js            # register/on/fire, created-gate, remove
    intervals-attach-dispose.test.js  # register/on/off/remove, dispose, fire
    popstate.test.js                  # start/stop/seed + push/set builtins
  builtins/
    buffer-error.test.js              # buffer.* + error.capture/fail
    http-send.test.js                 # http.send with mocked lib.request.send
    form.test.js                      # form.prepare/collect/toEnvelope/submit
    target.test.js                    # target.patch/class/find/buffer bridge
    dom-e.test.js                     # dom.attempt + e.* traversal
  unit/
    buffer.test.js            # pure Buffer class
    helpers-stage.test.js     # STAGE_STATUS / SR_* / makeRunTicket
    expressions.test.js       # ExpressionResolver paths
    schema-compile.test.js    # Master schema compiler normalization
    merge-opts.test.js        # MERGE_OPTS_V1 array replace
  install/
    install.test.js           # installNamespace / installService contracts
    standalone-dist.test.js   # dist/nomap bundle install() smoke (skips if unbuilt)
```

## Coverage map

| Area | Locks in |
|---|---|
| Enqueue/drain | multi-stage complete, buffer handoff, hooks |
| Dedupe | same job+pipelineKey → `returnMeta.created === false` |
| Re-entrancy | concurrent `drain()` does not double-step |
| Wait/resume | `lock.until`, buffer preserved, `pulse` resumes |
| Errors | error pipeline recovery; hard terminal error |
| Cancel | queued drop; active cancel → error + index clear |
| Lock | block drain; token mismatch; unlock resume |
| Tick | one stage per call; complete terminal |
| Cascade | two pipeline keys on one job both complete |
| Inputs / ws | ticket inputs; workspace across tickets |
| Stage returns | falsy → error; `{status:'complete'}` short-circuit |
| Discover | sweep selector; scan idempotent per element |
| Runtime attach/dispose | attachObservedNodes skip known; dispose unregisters |
| Events | register/on install; fire drain; live-ticket no double-step; remove |
| Intervals | register without start; on/off/remove; fire→pulse; dispose cancels |
| Popstate | start/stop/seed; push/set history; replay skip |
| Schema/DSL | pipelines/events/intervals/requests normalize; DSL ops |
| Merge policy | arrays replace under MERGE_OPTS_V1 |
| Buffer builtins | set/get/clear direct + `@buffer.*` engine path |
| Error builtins | capture to ws; fail → error pipeline |
| HTTP | named request send; missing name; adhoc url; status policy |
| Form | prepare trigger; collect parms; toEnvelope; submit mock |
| Target | patch/set/reset; class*; find/parent/child; buffer bridge |
| DOM / e | dom.attempt; e.self/find/closest/parent/child |
| Buffer class | set/get/meta/clear/toJSON |
| Expressions | job/ws/buffer/ticket/config/ctx paths |
| Install | namespace + service registration, force reuse |
| Standalone dist | import min bundle, `install()`, headless drain (skip if no dist) |

## Adding tests

1. Prefer `createAT()` + `createHeadlessJob()` from `helpers/`.
2. Use unique job names when sharing a process.
3. Assert public surfaces: `enqueue` / `tick` / `drain` / `pulse` + hook recorder.
4. Keep controller/DOM suites separate from engine spine tests.
5. Stay under `test/` only unless production changes are intentional.
