# Happy Hacker Handbook for LLMs

[README](../../README.md) -> [API Index](./INDEX.md) -> [ActiveTags API Contract](./ACTIVE_TAGS_API_CONTRACT.md) -> [Happy Hacker Handbook](./HAPPY_HACKER_HANDBOOK_LLM.md)

This handbook is a practical companion to the API contract for LLM-assisted work.

Use this file to stay fast without drifting into legacy or undefined behavior.

---

## Mission

When changing or integrating ActiveTags:

1. Read the contract first.
2. Change active runtime files only.
3. Keep compile-first and enqueue-first behavior intact.
4. Treat inert/archival files as non-normative reference only.

---

## First Read Order (LLM-safe)

1. [ACTIVE_TAGS_API_CONTRACT.md](./ACTIVE_TAGS_API_CONTRACT.md)
2. [reference/INDEX.md](./reference/INDEX.md)
3. [ACTIVE_TAGS.md](./ACTIVE_TAGS.md)
4. [CONTROLLERS.md](./CONTROLLERS.md)
5. [ENGINE.md](./ENGINE.md)

If anything conflicts, follow the contract.

---

## Stable Runtime Anchors

Assume these top-level surfaces are stable:

* `AT.engine`
* `AT.jobs`
* `AT.runtime`
* `AT.events`
* `AT.intervals`
* `AT.observer`
* `AT.discover`
* `AT.conf`

Core startup rule:

* `start()` discovers/registers jobs and activates controllers; controllers enqueue work, engine executes work.

---

## Active Source of Truth (Code Paths)

Use these as primary implementation anchors:

* `src/ActiveTags.js`
* `src/class/runtime/Controller.js`
* `src/class/engine/Engine.js`
* `src/class/engine/vm/VM.js`
* `src/class/job/Job.js`
* `src/class/job/config/JobConfig.js`
* `src/class/expressions/ExpressionResolver.js`
* `src/class/job/config/domConfigSource/traits/configTargetResolver.js`
* `src/builtins/index.js`
* `src/builtins/http/httpSend.js`

---

## Inert / Archival Boundaries

Files tagged with these markers are inert and excluded from runtime truth:

* `[AT_INERT_ARCHIVE]`
* `[AT_INERT_LEGACY_V098]`

Current inert examples:

* `src/class/job/config/JobConfig.removed.js`
* `src/class/job/config/domConfigSource/_backupResolveConfigTarget.js`
* `src/class/expressions/ExpressionResolver.098.js`

Rules:

* Do not import inert files from active runtime paths.
* Do not use inert files to infer current behavior.
* Do not use inert files as public documentation sources.

---

## Behavioral Guardrails (Do Not Break)

1. Compile-first posture: config is compiled before activation/execution.
2. Enqueue-first posture: controllers enqueue; engine/VM executes.
3. Stage status contract stays normalized: `ok`, `wait`, `error`, `complete`.
4. Headless jobs keep no required DOM anchor and use runtime fallback semantics.
5. Public API changes must update API docs and contract together.

---

## Safe Edit Workflow for LLMs

1. Confirm the intended behavior in the contract and reference docs.
2. Locate active implementation path, ignoring inert markers.
3. Make minimal edits that preserve lifecycle boundaries.
4. Update docs when public behavior or examples change.
5. Run quick verification commands:

```bash
find src -type f -name '*.js' ! -name '*.removed.js' ! -name '_backup*.js' -print0 | xargs -0 -n1 node --check
find examples -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

6. Verify no new imports reference inert files.

---

## Prompt Recipes (Copy/Paste)

### Add a new builtin operation

```text
Use docs/api/ACTIVE_TAGS_API_CONTRACT.md and docs/api/BUILTINS.md as source of truth.
Add a new builtin in active runtime paths only.
Do not modify inert files tagged [AT_INERT_ARCHIVE] or [AT_INERT_LEGACY_V098].
Wire it through src/builtins/index.js and update usage/api docs for the public surface.
Run node --check on src and examples (excluding inert files) after edits.
```

### Debug a pipeline behavior

```text
Trace from controller enqueue to engine execution to VM stage result.
Preserve the normalized status model: ok/wait/error/complete.
When suggesting fixes, cite active files only and ignore inert files.
```

### Add or adjust headless job flow

```text
Use contract headless guarantees and AT.runtime APIs.
Implement only in active files (runtime controller, job, vm as needed).
Keep headless behavior DOM-optional while preserving execution fallback semantics.
Update docs/api/reference if external behavior changes.
```

---

## Release Hygiene Checklist

1. Active JS syntax checks pass.
2. No runtime imports from inert files.
3. Contract and API docs reflect any public behavior changes.
4. Examples touched by change still parse and align with docs.

---

## See Also

* [ACTIVE_TAGS_API_CONTRACT.md](./ACTIVE_TAGS_API_CONTRACT.md)
* [INDEX.md](./INDEX.md)
* [reference/INDEX.md](./reference/INDEX.md)
* [../usage/TOC.md](../usage/TOC.md)
