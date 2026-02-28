# API Reference — Builtins Surface

[README](../../README.md) -> [API Index](./INDEX.md)


Builtins root export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

---

## Namespaces

### Root

* [`confirm`](../usage/builtins/confirm/confirm.md) - Runs a confirmation gate and fails stage when the check is rejected.

### `form`

* [`form.collect`](../usage/builtins/form/collect.md) - Collects form fields into normalized params/body structures.
* [`form.prepare`](../usage/builtins/form/prepare.md) - Resolves and stores the effective form target for downstream steps.
* [`form.submit`](../usage/builtins/form/submit.md) - Sends form-derived requests and writes response output to buffer.
* [`form.toEnvelope`](../usage/builtins/form/toEnvelope.md) - Converts collected form payload into a request envelope.
* [`form.headers`](../usage/builtins/form/headers.md) - Adds/merges request headers into the envelope path.

### `dom`

* [`dom.attempt`](../usage/builtins/dom/attempt.md) - Attempts to resolve a DOM node from selector/path/element input.

### `error`

* [`error.dump`](../usage/builtins/error/dump.md) - Emits structured runtime error diagnostics for troubleshooting.
* [`error.fail`](../usage/builtins/error/fail.md) - Forces a StageResult error with optional custom message/context.

### `buffer`

* [`buffer.set`](../usage/builtins/buffer/set.md) - Replaces ticket buffer value and optional metadata.
* [`buffer.get`](../usage/builtins/buffer/get.md) - Reads from buffer (optionally by path) for downstream usage.
* [`buffer.clear`](../usage/builtins/buffer/clear.md) - Clears buffer payload and related metadata state.
* [`buffer.dump`](../usage/builtins/buffer/dump.md) - Logs/inspects current buffer payload for debugging.
* [`buffer.traverse`](../usage/builtins/buffer/traverse.md) - Moves buffer focus to a nested path value.
* [`buffer.assert`](../usage/builtins/buffer/assert.md) - Validates buffer content against expected conditions.

### `target`

* [`target.patch`](../usage/builtins/target/patch.md) - Applies patch-style DOM updates to the current target node.
* [`target.reset`](../usage/builtins/target/reset.md) - Resets `ticket.target` to the default job element context.
* [`target.set`](../usage/builtins/target/set.md) - Sets `ticket.target` from selector/path/element input.
* [`target.propGet`](../usage/builtins/target/propGet.md) - Reads a target property/path and writes result to buffer.
* [`target.propSet`](../usage/builtins/target/propSet.md) - Writes a property/path value on the current target.
* [`target.classAdd`](../usage/builtins/target/classAdd.md) - Adds CSS class(es) on the current or explicit target.
* [`target.classRemove`](../usage/builtins/target/classRemove.md) - Removes CSS class(es) on the current or explicit target.
* [`target.classSet`](../usage/builtins/target/classSet.md) - Replaces target class state with a specified class list.
* [`target.classReset`](../usage/builtins/target/classReset.md) - Clears target classes back to an empty baseline.
* [`target.classToggle`](../usage/builtins/target/classToggle.md) - Toggles class presence on the current or explicit target.
* [`target.fromBuffer`](../usage/builtins/target/fromBuffer.md) - Derives target from buffer content and assigns `ticket.target`.
* [`target.toBuffer`](../usage/builtins/target/toBuffer.md) - Writes the current target reference into buffer.
* [`target.closest`](../usage/builtins/target/closest.md) - Moves target to closest matching ancestor.
* [`target.find`](../usage/builtins/target/find.md) - Finds a descendant/base match and assigns it as target.
* [`target.parent`](../usage/builtins/target/parent.md) - Moves target to parent element (optionally nth parent).
* [`target.child`](../usage/builtins/target/child.md) - Moves target to child element by index/selector.

### `e`

* [`e.reset`](../usage/builtins/e/reset.md) - Resets target to `job.e` root element context.
* [`e.self`](../usage/builtins/e/self.md) - Sets target directly to `job.e`.
* [`e.find`](../usage/builtins/e/find.md) - Finds descendant from `job.e` and assigns target.
* [`e.closest`](../usage/builtins/e/closest.md) - Resolves closest ancestor from `job.e` anchor context.
* [`e.parent`](../usage/builtins/e/parent.md) - Moves target to parent from `job.e`-anchored traversal.
* [`e.child`](../usage/builtins/e/child.md) - Moves target to child from `job.e`-anchored traversal.

### `http`

* [`http.send`](../usage/builtins/http/send.md) - Executes HTTP request resolution/send and exports response to buffer.

---

## Operation contract posture

Operations are designed to return normalized stage-like responses for VM dispatch.

Reference status helpers:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)
