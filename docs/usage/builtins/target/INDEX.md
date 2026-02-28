# Target Builtins (`target.*`)

[Builtins Index](../INDEX.md)

Module source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Target Input Semantics

For target-aware ops (`target.*` ops that accept `target=...`), the `target` input can be:

* a selector/path string resolvable by `lib.dom.attempt(...)`
* an actual DOM Element
* an interpolated DSL value that resolves to an element (for example `${doc:#something}`)

## Functions

* [`target.patch`](./patch.md)
* [`target.reset`](./reset.md)
* [`target.set`](./set.md)
* [`target.propGet`](./propGet.md)
* [`target.propSet`](./propSet.md)
* [`target.classAdd`](./classAdd.md)
* [`target.classRemove`](./classRemove.md)
* [`target.classSet`](./classSet.md)
* [`target.classReset`](./classReset.md)
* [`target.classToggle`](./classToggle.md)
* [`target.fromBuffer`](./fromBuffer.md)
* [`target.toBuffer`](./toBuffer.md)
* [`target.closest`](./closest.md)
* [`target.find`](./find.md)
* [`target.parent`](./parent.md)
* [`target.child`](./child.md)
