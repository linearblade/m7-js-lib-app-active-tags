
/**
 * requireLibs(root, targets, opts?)
 *
 * Standalone dependency validator for nested paths.
 * Does NOT rely on m7 lib utilities (array/hash), so it can run during bootstrap.
 *
 * @param {object} root - root object to validate against (e.g. window.lib)
 * @param {string|string[]} targets - space-delimited string or array of dot-paths
 * @param {object} [opts]
 * @param {string} [opts.mod='[requireLibs]'] - label for error messages
 * @param {boolean} [opts.returnMap=false] - return {path:value} instead of array
 * @param {boolean} [opts.allowFalsy=true] - if false, falsy values fail (rare)
 * @returns {any[]|Record<string, any>} resolved values
 * @throws Error if any target is missing
 */
export function requireLibs(root, targets, opts = {}) {
  const mod = opts.mod || '[requireLibs]';
  const allowFalsy = ('allowFalsy' in opts) ? !!opts.allowFalsy : true;

  if (root == null || (typeof root !== 'object' && typeof root !== 'function')) {
    throw new Error(`${mod} invalid root (expected object/function)`);
  }

  const list = Array.isArray(targets)
    ? targets
    : String(targets ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

  const outArr = [];
  const outMap = {};
  const missing = [];

  const getPath = (obj, path) => {
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let ptr = obj;
    for (const key of parts) {
      if (ptr == null) return undefined;
      // Use `in` to allow properties with falsy values
      if (!(key in Object(ptr))) return undefined;
      ptr = ptr[key];
    }
    return ptr;
  };

  for (const path of list) {
    const val = getPath(root, path);

    const ok = allowFalsy
      ? !(val === undefined || val === null)
      : !!val;

    if (!ok) {
      missing.push(path);
      continue;
    }

    outArr.push(val);
    outMap[path] = val;
  }

  if (missing.length) {
    throw new Error(`${mod} missing required targets: ${missing.join(', ')}`);
  }

  return opts.returnMap ? outMap : outArr;
}

export default requireLibs;
