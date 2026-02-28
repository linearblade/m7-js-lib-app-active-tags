/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import install, { ActiveTags } from './install.js';

const MOD = '[activeTags]';

const lib = (typeof window !== 'undefined' && window.lib) ? window.lib : null;
if (!lib) throw new Error(`${MOD} requires window.lib (browser environment).`);

if (typeof lib?.hash?.set !== 'function') {
  throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

// Normalize lib.site.delagator typo for older libs
if (!lib.site?.delegator && lib.site?.delagator) {
  lib.site.delegator = lib.site.delagator;
}

// Install ActiveTags namespace + service into lib.
const result = install(lib);
const activeTags =
  result && result.namespace && typeof result.namespace.ActiveTags === 'function'
    ? result.namespace.ActiveTags
    : ActiveTags;

export { ActiveTags, activeTags, install };
export default activeTags;
