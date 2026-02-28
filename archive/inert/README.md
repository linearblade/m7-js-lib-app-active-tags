# Inert Archive

This directory stores reference-only source files that are intentionally not part of the active runtime.

Rules:

* do not import files from this directory into runtime code
* do not treat these files as supported API surface
* keep files here only for historical/comparison purposes

Current archived files:

* `ExpressionResolver.098.js`
* `JobConfig.removed.js`
* `_backupResolveConfigTarget.js`

Original locations (pre-archive):

* `ExpressionResolver.098.js` -> `src/class/expressions/ExpressionResolver.098.js`
* `JobConfig.removed.js` -> `src/class/job/config/JobConfig.removed.js`
* `_backupResolveConfigTarget.js` -> `src/class/job/config/domConfigSource/_backupResolveConfigTarget.js`
