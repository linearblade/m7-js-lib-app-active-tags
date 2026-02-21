# RequestHTTP Example: Standardize Debug Toggle

[TODO index](../../INDEX.md) | [examples open](../OPEN.md) | [examples done](../DONE.md)

## Goal
Keep tutorial behavior visible while making default example output clean and production-like.

## Problem
`examples/requestHTTP/request-form.js` currently includes direct debug output paths (`dumpBuffer`, `console.warn`) that are always active in the default run path.

## Primary Targets
- `examples/requestHTTP/request-form.js`
- optional shared flag module under `examples/`

## Proposed Change
Add a lightweight debug toggle pattern:
- central flag source (for example `examples/_flags.js`)
- `dumpBuffer` execution only when debug is enabled
- default pipeline path avoids noisy console output

## Deliverables
- debug toggle utility or constant
- requestHTTP pipeline updated to use toggle
- short comment/doc note showing how to enable debug mode

## Acceptance Criteria
- default requestHTTP example runs with clean console.
- debug mode can still be enabled in one obvious place.
- no behavior change in request execution or rendering.

## Out of Scope
- changing requestHTTP feature behavior
- removing debug capability entirely

