/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Deep-freeze an object graph.
 *
 * Purpose:
 * - Prevent mutation of creation-time / configuration artifacts.
 * - Intended for "build once, read many" structures.
 *
 * Semantics:
 * - Recursively freezes arrays and plain objects.
 * - Scalars and non-plain objects are frozen shallowly or ignored.
 *
 * Notes:
 * - This mutates the input object by freezing it.
 * - Callers should deep-copy first if mutation is undesirable.
 *
 * @param {*} value
 * @returns {*} The same value, deeply frozen if applicable.
 */
function freezeDeep(value) {
    if (!value || typeof value !== "object") return value;
    if (Object.isFrozen(value)) return value;

    // Array
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            freezeDeep(value[i]);
        }
        return Object.freeze(value);
    }

    // Plain object only
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        return Object.freeze(value);
    }

    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        freezeDeep(value[key]);
    }

    return Object.freeze(value);
}

export { freezeDeep };
export default freezeDeep;
