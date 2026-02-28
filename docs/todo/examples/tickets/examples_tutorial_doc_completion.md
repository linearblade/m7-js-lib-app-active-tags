# Complete Usage Tutorial Document

[TODO index](../../INDEX.md) | [examples open](../OPEN.md) | [examples done](../DONE.md)

## Goal
Finish `docs/usage/TUTORIAL.md` so it is a real end-to-end guided tutorial, not a placeholder.

## Problem
`docs/usage/TUTORIAL.md` is currently incomplete and not ready as a primary onboarding path.

## Primary Targets
- `docs/usage/TUTORIAL.md`
- `docs/usage/TOC.md`
- `docs/usage/QUICKSTART.md`
- `docs/usage/EXAMPLES_LIBRARY.md`

## Proposed Change
- Expand tutorial into a practical sequence from install/startup to jobs, events, intervals, and requests.
- Ensure tutorial steps match current v1.0 DSL and standalone install flow.
- Link tutorial steps to current maintained examples (`inject/fromFile`, `stockTicker`, `headlessJobs`).

## Deliverables
- Completed `docs/usage/TUTORIAL.md` with runnable step sequence.
- Cross-links updated so tutorial is discoverable from usage docs.

## Acceptance Criteria
- Tutorial is no longer placeholder/incomplete.
- A new user can follow it without consulting source code.
- Terminology and code snippets align with current v1.0 runtime behavior.

## Out of Scope
- Rewriting architecture/API docs.
- Major example behavior changes unrelated to tutorial clarity.
