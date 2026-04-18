# Popstate Builtins (`popstate.*`)

[Builtins Index](../INDEX.md)

Module source:

* [../../../../src/builtins/popstate/index.js](../../../../src/builtins/popstate/index.js)

## Functions

* [`popstate.push`](./push.md)
* [`popstate.set`](./set.md)
* [`popstate.seed`](./seed.md)

## Notes

These builtins are the explicit pipeline-owned history API for ActiveTags.

Recommended usage:

* place `popstate.push` / `popstate.set` at the end of a successful pipeline
* use `popstate.seed` for one-time baseline setup
* prefer these builtins over event-level history config

