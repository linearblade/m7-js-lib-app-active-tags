# Builtins & Operations — ActiveTags

Builtins are VM-callable operation functions used inside pipeline stages.

Root builtin export:

* [../../src/builtins/index.js](../../src/builtins/index.js)

---

## Builtin families

### Form

* `form.collect`
* `form.prepare`
* `form.submit`
* `form.headers`

Source: [../../src/builtins/form/](../../src/builtins/form/)

### DOM

* `dom.patch`

Source: [../../src/builtins/dom/](../../src/builtins/dom/)

### Error

* `error.dump`
* `error.fail`

Source: [../../src/builtins/error/](../../src/builtins/error/)

### Buffer conveyor

* `buffer.set`
* `buffer.get`
* `buffer.clear`
* `buffer.traverse`

Source: [../../src/builtins/buffer/index.js](../../src/builtins/buffer/index.js)

### Target conveyor

* `target.reset`
* `target.set`
* `target.fromBuffer`
* `target.toBuffer`
* `target.closest`
* `target.find`
* `target.parent`
* `target.child`

Source: [../../src/builtins/target/index.js](../../src/builtins/target/index.js)

### HTTP

* `http.send` (namespace form from builtins root)

Source: [../../src/builtins/httpSend.js](../../src/builtins/httpSend.js)

---

## Stage result contract

Builtin ops should return normalized stage-like responses (`ok`, `wait`, `error`, `complete`) that VM can process consistently.

See helper contract shapes in:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## Related

* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Builtins subsystem notes -> [../architecture/subsystems/BUILTINS_BUFFER_TARGET.md](../architecture/subsystems/BUILTINS_BUFFER_TARGET.md)
