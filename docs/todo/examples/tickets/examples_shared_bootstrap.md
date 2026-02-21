# Extract Shared Example Runtime Bootstrap

[TODO index](../../INDEX.md) | [examples open](../OPEN.md) | [examples done](../DONE.md)

## Goal
Reduce copy/paste setup logic across examples by centralizing common runtime install/bootstrap code.

## Problem
`examples/requestHTTP/requestHTTP.js` and `examples/stockTicker/stockTicker.js` duplicate the same dependency install sequence and ActiveTags startup shape.

## Primary Targets
- `examples/requestHTTP/requestHTTP.js`
- `examples/stockTicker/stockTicker.js`
- new shared module under `examples/` (for example `examples/shared/bootstrapRuntime.js`)

## Proposed Change
Create shared bootstrap utility that:
- initializes lib
- installs common dependencies/services
- returns prepared `{ lib, AT }` (or helper that builds AT with supplied config)

Keep example-specific config and DOM wiring local to each example.

## Deliverables
- shared bootstrap module in examples
- requestHTTP and stockTicker entry files consume shared bootstrap
- reduced duplicate install code in example entry points

## Acceptance Criteria
- both examples still start and run as before.
- common install sequence exists in one place.
- per-example config differences remain explicit and local.

## Out of Scope
- changing core runtime architecture
- bundling/tooling changes outside example bootstrap flow

