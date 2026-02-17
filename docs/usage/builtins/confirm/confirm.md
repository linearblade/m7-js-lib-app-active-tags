# `confirm`

[Builtins Index](../INDEX.md) -> [Confirm Module](./INDEX.md)

Source:

* [../../../../src/builtins/confirm.js](../../../../src/builtins/confirm.js)

## Args

Accepted from `args` hash:

* `message`: dialog text override
* `enabled`: explicit enable/disable override

Fallback message precedence:

1. `args.message`
2. `data-confirm`
3. `data-confirm-text` / `data-confirm-message`
4. `"Are you sure?"`

## Side Effects

* Opens `window.confirm(...)` when enabled and available.
* Sets `inputs.cancelled = true` when user cancels.
* In headless/no-window runtimes, soft-skips with `ok` status.

## Return Contract

* `ok`: confirmed, disabled, or skipped (no confirm API).
* `complete`: user cancelled.
* `error`: unexpected runtime error.
