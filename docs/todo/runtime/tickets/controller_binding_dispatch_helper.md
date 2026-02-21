# Extract Shared Binding Dispatch Helper (Global / Single / All)

#Note : I dont like this too much yet. b/c the service level shape of all these jobs isnt quite clear in my mind, and I'll probably change this again. it will probably shake out
 after I redo 'headless' jobs (jobs without dom attached


## Goal
Reduce repeated branching logic in controller methods that support:
- global mode (all jobs)
- single-binding mode
- all-bindings-for-job mode

## Problem
Several methods repeat the same dispatch shape with minor differences (`on`, `off`, `conditionalOn`, similar interval/event variants). This increases cognitive load and bug-fix overhead.

## Primary Targets
- `src/class/event/Controller.js`
- `src/class/interval/Controller.js`

## Proposed Change
Introduce an internal iterator/dispatcher helper with a contract like:
- resolve target job(s)
- iterate selected binding names
- invoke provided per-binding executor
- return aggregate count

Keep public method signatures unchanged.

## Deliverables
- shared internal dispatch utility for controller methods
- event and interval methods migrated to use it where applicable
- simpler top-level controller methods (less branching/loop duplication)

## Acceptance Criteria
- Existing method return counts remain compatible.
- Global mode still skips unresolved/missing jobs safely.
- Single-binding and all-bindings behavior remain unchanged.
- No public API signature changes.

## Out of Scope
- runtime behavior redesign
- event/interval schema normalization changes

