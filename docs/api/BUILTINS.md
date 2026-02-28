# API Reference — Builtins Surface

[README](../../README.md) -> [API Index](./INDEX.md)


Builtins root export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

---

## Namespaces

### Root

* confirm

### `form`

* collect
* prepare
* submit
* toEnvelope
* headers

### `dom`

* attempt

### `error`

* dump
* fail

### `buffer`

* set
* get
* clear
* dump
* traverse
* assert

### `target`

* patch
* reset
* set
* propGet
* propSet
* classAdd
* classRemove
* classSet
* classReset
* classToggle
* fromBuffer
* toBuffer
* closest
* find
* parent
* child

### `e`

* reset
* self
* find
* closest
* parent
* child

### `http`

* send

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
