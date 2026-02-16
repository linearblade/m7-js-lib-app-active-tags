// builtins/dom/index.js
import patch from './domPatch.js';

/**
 * DOM builtin op labels.
 *
 * These keys map to operations exported under the `dom.*` namespace.
 *
 * @type {{PATCH: string}}
 */
const DOM = {
    PATCH: "patch",
    // grow here: HTML, TEXT, ATTR, CLASS_ADD, CLASS_REMOVE, REMOVE, APPEND, etc.
};

export { DOM };

// Named exports (ergonomic for direct import)
export const domPatch = patch;

// Default export: iterable builtin tree for barrel registration
export default {
    [DOM.PATCH]: patch,
};
