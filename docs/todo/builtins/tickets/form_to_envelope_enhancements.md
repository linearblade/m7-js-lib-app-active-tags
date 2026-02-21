# form.toEnvelope Enhancements

[TODO index](../../INDEX.md) | [builtins open](../OPEN.md) | [builtins done](../DONE.md)

Goal: make `@form.toEnvelope` the primary bridge from collected form payloads to editable request envelopes used by `@http.send`.

## Action List

- [ ] Add `query` merge support:
  merge `args.query` into `envelope.endpoint.query` after URL/method resolution.

- [ ] Add response policy shorthand passthrough:
  accept `requireOk`, `acceptedStatus`, `return`, `parse`, `path` directly in args and map into `envelope.response`.

- [ ] Add `only` and `omit` field filters:
  allow limiting collected key/value rows before body assembly.

- [ ] Add `rename` map support:
  remap collected keys before serialization (for example `user.email -> email`).

- [ ] Add optional type coercion pass for JSON mode:
  parse simple scalar strings (`"true"`, `"false"`, numerics, `"null"`) into native values.

- [ ] Add body root wrapping option:
  support wrapping body as `{ <wrapKey>: <collected-json> }`.

- [ ] Add explicit source override support:
  allow `args.source` to collect from a provided selector/element instead of `trigger || job.e`.

- [ ] Add file handling policy control:
  support `file: true` passthrough and define JSON/file behavior policy (`strip`, `error`, `forceFormData`).

- [x] Add docs page for `form.toEnvelope`:
  include args contract, examples, and recommended pipeline patterns (`collect -> toEnvelope -> http.send`).

- [ ] Add example flow:
  a minimal example showing envelope mutation between `toEnvelope` and `http.send`.
