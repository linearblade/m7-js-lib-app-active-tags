// builtins/dom/index.js
import attempt from './domAttempt.js';

/**
 * DOM builtin op labels.
 *
 * These keys map to operations exported under the `dom.*` namespace.
 *
 * @type {{ATTEMPT: string}}
 */
const DOM = {
    ATTEMPT: "attempt",
    // grow here: CLASS_ADD, CLASS_REMOVE, REMOVE, APPEND, etc.
};

export { DOM };

// Named exports (ergonomic for direct import)
export const domAttempt = attempt;

// Default export: iterable builtin tree for barrel registration
export default {
    [DOM.ATTEMPT]: attempt,
};
