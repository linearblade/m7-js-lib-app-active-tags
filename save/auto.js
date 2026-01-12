import TreeInspector from './TreeInspector.js';

// Ensure environment and dependencies
if (typeof window === 'undefined') {
  throw new Error("[TreeInspector] This module requires a browser-like environment with window.lib.");
}

const lib = window.lib;

if (!lib || typeof lib.hash?.set !== 'function') {
    throw new Error("[TreeInspector] m7-lib must be installed with lib.hash.set before loading this module.");
}

// Perform the registration
lib.hash.set(lib, 'tree', TreeInspector);

export default TreeInspector;
