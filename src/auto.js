import ActiveTags from './ActiveTags.js';

const MOD = '[activeTags]';

// Browser + lib guard
const lib = (typeof window !== 'undefined' && window.lib) ? window.lib : null;

if (!lib) {
  throw new Error(`${MOD} requires window.lib (browser environment).`);
}

if (typeof lib?.hash?.set !== 'function') {
  throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

// Register into lib hierarchy (idempotent / overwrite-safe)
lib.hash.set(lib, 'site.activeTags', ActiveTags);

export { ActiveTags };
export default ActiveTags;
