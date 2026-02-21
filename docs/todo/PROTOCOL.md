# TODO Protocol

[TODO index](./INDEX.md)

This file is the authoritative process for maintaining `docs/todo/**`.
Use this protocol whenever adding, updating, or completing TODO items.

## Structure Contract

`docs/todo/` must follow:

- `INDEX.md`
- `<section>/OPEN.md`
- `<section>/DONE.md`
- `<section>/tickets/*.md`

Current sections:

- `examples`
- `builtins`
- `runtime`
- `architecture`

Do not create ad-hoc TODO files at `docs/todo/*.md` (root-level tickets).
Tickets must live under a section `tickets/` directory.

## Navigation Contract

Every section page (`OPEN.md` and `DONE.md`) must include this nav line under the title:

`[TODO index](../INDEX.md) | [open](./OPEN.md) | [done](./DONE.md)`

Every ticket page must include this nav line under the title:

`[TODO index](../../INDEX.md) | [<section> open](../OPEN.md) | [<section> done](../DONE.md)`

## Formatting Contract

### `INDEX.md`

Use section entries in this form:

- `section_name`:
    - [open](./section_name/OPEN.md)
    - [done](./section_name/DONE.md)

### `OPEN.md` entries

Use checkbox + 4-space-indented ticket line:

- [ ] Short task title
    - Ticket: [tickets/file_name.md](./tickets/file_name.md)

### `DONE.md` entries

Use completed checkbox + same 4-space ticket indentation:

- [x] Short task title
    - Ticket: [tickets/file_name.md](./tickets/file_name.md)

Important: ticket bullet indentation is **4 spaces** under the task line.

## Ticket File Rules

- File names: lowercase snake_case, descriptive, `.md`.
- One ticket = one focused workstream.
- Keep problem/goal/scope explicit.
- Include concrete file pointers.

Recommended ticket skeleton:

```md
# Ticket Title

[TODO index](../../INDEX.md) | [<section> open](../OPEN.md) | [<section> done](../DONE.md)

## Goal
...

## Problem
...

## Primary Targets
- `path/...`

## Proposed Change
...

## Deliverables
- ...

## Acceptance Criteria
- ...

## Out of Scope
- ...
```

## Add New TODO Item Procedure

1. Choose the correct section (`examples`, `builtins`, `runtime`, `architecture`).
2. Create the ticket file under `docs/todo/<section>/tickets/`.
3. Add an entry to `docs/todo/<section>/OPEN.md` using the exact open format.
4. Verify nav links and relative paths.
5. Keep wording concise and action-oriented.

## Complete TODO Item Procedure

1. Update task status in `docs/todo/<section>/OPEN.md` by removing the item.
2. Add the completed entry in `docs/todo/<section>/DONE.md` with `[x]`.
3. Keep the same ticket link path.
4. Optionally add completion notes inside the ticket.

## Hygiene Checks (Required)

After edits, verify:

- no broken relative links in touched files
- every `OPEN`/`DONE` entry points to an existing ticket
- no orphan tickets without an index entry
- no backup artifacts committed (for example `*.md~`)

## Change Policy

- Preserve existing section boundaries unless explicitly requested.
- Prefer updating existing tickets over creating duplicates.
- Keep this protocol updated if the TODO structure changes.
