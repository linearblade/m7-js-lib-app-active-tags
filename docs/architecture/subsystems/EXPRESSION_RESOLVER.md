# Subsystem — Expression Resolver

Expression resolver provides target parsing/evaluation for runtime interpolation and stage argument materialization.

---

## Component

* [../../../src/class/expressions/ExpressionResolver.js](../../../src/class/expressions/ExpressionResolver.js)
* Dispatch helpers -> [../../../src/class/expressions/dispatch.js](../../../src/class/expressions/dispatch.js)
* Interpolator -> [../../../src/class/expressions/Interpolator.js](../../../src/class/expressions/Interpolator.js)

---

## Responsibilities

* parse `type:locator` target expressions
* evaluate parsed references against runtime context (`job`, `ticket`, `buffer`, DOM)
* provide interpolation and materialization helpers used by VM

---

## Notes

* current runtime file is `ExpressionResolver.js`
* legacy `ExpressionResolver.098.js` is inactive/reference-only

