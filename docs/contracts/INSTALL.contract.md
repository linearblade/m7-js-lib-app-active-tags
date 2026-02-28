# Install Contract

[README](../../README.md) -> [API Index](../api/INDEX.md) -> [Source Contracts](./INDEX.md) -> [Install Contract](./INSTALL.contract.md)

Source: [../../src/install.js](../../src/install.js)

---

## Purpose

Define canonical ActiveTags installation behavior when prerequisites are already
available in `lib`.

This module owns:

* namespace install at `lib.app.ActiveTags`
* service install at `lib.service` under `SERVICE_ID` (`app.activetags`)
* dependency/service presence assertions before instance wiring

This module does not install primitive dependencies.

---

## Exports

* `installNamespace(lib)`
* `installService(lib, opts?)`
* `install(lib, opts?)`
* `ActiveTags`
* `NAMESPACE_ID` (`app.ActiveTags`)
* `SERVICE_ID` (`app.activetags`)
* `VERSION`

---

## Preconditions

`installNamespace(lib)` requires:

* `lib` is object-like
* `lib.hash.set` is callable

`installService(lib, opts?)` requires:

* namespace exists (provided or auto-installed)
* `lib.require.all` is callable
* `lib.require.service` is callable
* `lib.service.set` is callable
* all `CORE_DEPS` resolve
* all `CORE_SERVICES` resolve

---

## Behavior

### `installNamespace(lib)`

1. Validates `lib` + `lib.hash.set`.
2. Registers constructor at `lib.hash.set(lib, "app.ActiveTags", ActiveTags)`.
3. Returns `{ namespace, installedNamespace: true }`.

### `installService(lib, opts?)`

1. Validates `lib` + required dependency/service APIs.
2. Ensures namespace (uses `opts.namespace` when valid, otherwise installs it).
3. Resolves candidate instance in precedence order:
   * existing service instance when `force !== true`
   * provided `opts.instance` when valid
   * `new ActiveTags(lib, opts.conf || {})`
4. Registers resolved instance at `lib.service.set(SERVICE_ID, instance)`.
5. Returns `{ namespace, instance, installedService: true }`.

### `install(lib, opts?)`

1. Runs `installNamespace(lib)`.
2. Runs `installService(lib, { ...opts, namespace })`.
3. Returns service-install result.

---

## Instance Compatibility Contract

Provided `opts.instance` must be ActiveTags-compatible:

* `instanceof ActiveTags` OR
* object with:
  * function `start`
  * own properties `lib`, `engine`, `jobs`

If incompatible, installation throws.

---

## Error Contract

Installation throws on contract violations including:

* missing/invalid `lib`
* missing `lib.hash.set`
* missing `lib.require.all` / `lib.require.service`
* unresolved required dependencies/services
* missing `lib.service.set`
* invalid injected `opts.instance`

Errors are fail-fast and intended to stop startup before partial runtime state.

---

## Invariants

After successful full install:

* constructor namespace exists at `lib.app.ActiveTags` via hash path
* service instance is set at `lib.service.get("app.activetags")`
* installed instance is ActiveTags-compatible
* required dependency/service contracts were asserted before service registration

---

## Non-goals

This module does not:

* auto-install primitive repos/services
* auto-start runtime (`AT.start()` remains caller-controlled)
* mutate primitive configuration policies

Standalone primitive/bootstrap behavior belongs in:

* [../../src/standalone/install.js](../../src/standalone/install.js)
