# Split DomConfigSource Resolution Pipeline

[TODO index](../../INDEX.md) | [architecture open](../OPEN.md) | [architecture done](../DONE.md)

## Goal
Refactor `DomConfigSource` resolution internals into smaller focused units to improve maintainability without changing behavior.

## Problem
`_resolveConfigTarget(...)` currently handles multiple responsibilities in one path:
- import detection and import execution
- expression resolution
- source dereference handling (`{src,prop}`)
- DOM payload acquisition (inline + external fetch)
- payload parsing/eval gate
- object-type enforcement and error reporting

This is a high-impact method and difficult to modify safely.

## Primary Targets
- `src/class/job/config/DomConfigSource.js`

## Proposed Change
Split into focused private helpers, for example:
- `_resolveTargetRef(...)`
- `_resolveRefValue(...)`
- `_readDomPayload(...)`
- `_parseDomPayload(...)`
- `_ensureHashResult(...)`

Preserve existing report codes and strict/non-strict behavior.

## Deliverables
- smaller helpers with clear contracts
- existing method remains orchestration layer
- no external API changes to `read(...)`

## Acceptance Criteria
- Existing error codes/messages remain stable where practical.
- `read(...)` output shape remains unchanged.
- import/eval policy gates remain unchanged.
- no runtime behavior regressions in `requestHTTP` / `stockTicker` examples.

## Out of Scope
- changing security policy defaults
- changing config merge precedence

