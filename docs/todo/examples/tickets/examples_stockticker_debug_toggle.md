# StockTicker Example: Standardize Debug Toggle

## Goal
Use the same debug-toggle posture as other examples so tutorial defaults remain clean.

## Problem
`examples/stockTicker/header.js` currently uses direct console output in core tutorial handlers (`console.warn`, `console.log`) without a central toggle.

## Primary Targets
- `examples/stockTicker/header.js`
- optional shared flag module under `examples/`

## Proposed Change
Route debug logging through a simple toggle helper:
- `debugLog(...)` / `debugWarn(...)` wrappers
- wrappers no-op by default
- one obvious switch to enable tutorial diagnostics

## Deliverables
- stockTicker handlers migrated to toggle-based logging
- shared toggle pattern aligned with requestHTTP example

## Acceptance Criteria
- default stockTicker example runs without noisy debug logs.
- developers can enable logs quickly for troubleshooting.
- buy/sell/login tutorial behavior remains unchanged.

## Out of Scope
- changing stockTicker domain logic
- redesigning example UX

