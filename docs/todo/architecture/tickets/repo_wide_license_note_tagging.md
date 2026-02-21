# Repository-Wide License Note Tagging

[TODO index](../../INDEX.md) | [architecture open](../OPEN.md) | [architecture done](../DONE.md)

## Goal
Define and apply a consistent license note/header policy across repository files.

## Problem
License notice coverage is inconsistent. Some files may contain no explicit
license note, while others use different wording or placement.

## Primary Targets
- `src/**`
- `docs/**`
- `examples/**`
- root-level files where applicable

## Proposed Change
- Define one canonical license note/header template.
- Define include/exclude rules by file type and path.
- Add/update license notes in-scope files only.
- Avoid modifying generated/vendor/third-party or binary assets.

## Deliverables
- policy doc for license-note placement and wording
- repository pass that applies the policy to in-scope files
- audit list of excluded paths and reasons

## Acceptance Criteria
- in-scope files match one approved license note format
- excluded files/paths are documented
- no functional/runtime behavior changes from the tagging pass

## Out of Scope
- changing license type for the project
- legal interpretation beyond implementing the chosen policy text
