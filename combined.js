

# --- begin: applyMixins.js ---

//only handles instance methods for now.

export function applyMixins(targetClass, ...mixins) {
    for (const mixin of mixins) {
        Object.assign(targetClass.prototype, mixin);
    }
}

export default applyMixins;



# --- end: applyMixins.js ---



# --- begin: auto.js ---

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


# --- end: auto.js ---



# --- begin: ClassInspector.js ---

// ClassInspector.js
//
// TreeInspector mixin traits for class expansion.
// Produces "statics" and "prototype" children under a class node.
//
// Conventions:
// - Children are addressable via:
//   - <ClassPath>.<staticName>
//   - <ClassPath>.prototype.<methodName>
// - We mark generated nodes with `synthetic: true`
// - We avoid built-in noise by default (configurable)
// being instance shit
function getInstanceMeta(obj) {
    if (!obj || typeof obj !== "object") return null;

    const proto = Object.getPrototypeOf(obj);
    if (!proto) return null;

    // ignore plain objects
    if (proto === Object.prototype || proto === null) return null;

    const Ctor = proto.constructor;
    if (typeof Ctor !== "function") return null;

    // only treat actual `class` constructors as “instances”
    if (!isClassDefinition(Ctor)) return null;

    return {
	ctor: Ctor,
	className: Ctor.name || "(anonymous)",
    };
}

function getProtoChain(obj) {
  const out = [];
  let p = Object.getPrototypeOf(obj);
  while (p && p !== Object.prototype) {
    out.push(p);
    p = Object.getPrototypeOf(p);
  }
  return out;
}

function getProtoMembers(obj, { includeSymbols = true } = {}) {
  const chain = getProtoChain(obj);
  const out = [];

  for (const proto of chain) {
    const names = Object.getOwnPropertyNames(proto);
    for (const n of names) out.push({ key: n, proto });

    if (includeSymbols) {
      const syms = Object.getOwnPropertySymbols(proto);
      for (const s of syms) out.push({ key: s, proto });
    }
  }

  return out;
}
//end instance shit


function isCtorFunction(x) {
    return typeof x === "function";
}

function isClassLike(fn) {
  if (typeof fn !== "function") return false;

  // true classes
  if (isClassDefinition(fn)) return true;

  // Heuristic: functions with a prototype that has methods (non-enumerable)
  const proto = fn.prototype;
  if (proto && typeof proto === "object") {
    const names = Object.getOwnPropertyNames(proto).filter(n => n !== "constructor");
    const syms = Object.getOwnPropertySymbols(proto);
    if (names.length || syms.length) return true;
  }

  // Heuristic: constructor has interesting own props (statics)
  const own = Object.getOwnPropertyNames(fn).filter(n => !["length", "name", "prototype"].includes(n));
  if (own.length) return true;

  return false;
}

// "class Foo {}" => toString starts with "class "
function isClassDefinition(fn) {
    if (!isCtorFunction(fn)) return false;
    try {
	const s = Function.prototype.toString.call(fn);
	return /^\s*class\s/.test(s);
    } catch {
	return false;
    }
}

function getOwnKeys(obj, { includeSymbols = false } = {}) {
    const names = Object.getOwnPropertyNames(obj);
    if (!includeSymbols) return names;
    return names.concat(Object.getOwnPropertySymbols(obj));
}

function shouldSkipKey(key, { skipBuiltins = true } = {}) {
    if (!skipBuiltins) return false;
    // common noise
    return key === "length" || key === "name" || key === "prototype" || key === "caller" || key === "arguments";
}

// small helper for "type" classification of descriptors
function typeFromDescriptor(desc) {
    if (!desc) return "unknown";
    if ("value" in desc) {
	const v = desc.value;
	if (typeof v === "function") return "function";
	if (v === null) return "null";
	if (Array.isArray(v)) return "array";
	if (typeof v === "object") return "hash";
	return typeof v; // string/number/boolean/undefined/symbol/bigint
    }
    // accessor
    return "accessor";
}

export const ClassInspectorTraits = {
    // ---- public-ish helpers (callable from detail.js later if you want) ----
    isInspectableClass(ref) {
	return isClassDefinition(ref);
    },


    // ---- TreeInspector hook: expand class node children ----
//
// Desired shape:
//   MyClass
//     - y              (static)
//     - static_method  (static)
//     - prototype
//         - instance_method
//
_classChildren(node, { includeSymbols = true, skipBuiltins = true } = {}) {
  const Ctor = node?.ref;
  if (!isClassDefinition(Ctor)) return [];

  const out = [];

  // --- statics on the ctor (addressable: <ClassPath>.<key>) ---
  for (const key of getOwnKeys(Ctor, { includeSymbols })) {
    const name = typeof key === "symbol" ? key.toString() : String(key);
    if (shouldSkipKey(name, { skipBuiltins })) continue;

    const desc = Object.getOwnPropertyDescriptor(Ctor, key);
    const type = typeFromDescriptor(desc);

    const childPath = `${node.path}.${name}`;

    out.push({
      type,
      name,
      ref: desc?.value, // accessors => undefined here (ok)
      path: childPath,
      pathParts: childPath.split("."),
      parentPath: node.path,
      depth: node.depth + 1,
      synthetic: true,      // derived via reflection
      isStatic: true,       // <- enrichment you asked for
      ownerKind: "static",  // optional, useful in UI later
    });
  }

  // --- prototype folder (addressable: <ClassPath>.prototype.<key>) ---
  const protoPath = `${node.path}.prototype`;
  const protoFolder = {
    type: "hash",
    name: "prototype",
    ref: Ctor.prototype,
    path: protoPath,
    pathParts: protoPath.split("."),
    parentPath: node.path,
    depth: node.depth + 1,
    synthetic: true,
    isPrototype: true,
    // children are filled by TreeInspector's normal object parsing (with non-enum enabled in TreeInspector.js patch)
  };

  out.push(protoFolder);
  return out;
},
    
    // ---- TreeInspector hook: expand class node children ----
    //
    // Returns an array of "child nodes" in the TreeInspector node format:
    // { type, name, path, pathParts, parentPath, depth, ref, children?, synthetic? }
    //
    _oldclassChildren(node, { includeSymbols = true, skipBuiltins = false } = {}) {
	const Ctor = node?.ref;
	console.log('IN CLASS CHILDREN',node,Ctor);
	if (!isClassDefinition(Ctor)) return [];

	const out = [];

	// We add two synthetic folders: statics + prototype
	const staticsPath = `${node.path}.statics`;
	const protoPath = `${node.path}.prototype`;

	const staticsFolder = {
	    type: "hash",
	    name: "statics",
	    ref: Ctor, // folder is conceptual; ref points at ctor
	    path: staticsPath,
	    pathParts: staticsPath.split("."),
	    parentPath: node.path,
	    depth: node.depth + 1,
	    synthetic: true,
	    children: [],
	};

	const protoFolder = {
	    type: "hash",
	    name: "prototype",
	    ref: Ctor.prototype,
	    path: protoPath,
	    pathParts: protoPath.split("."),
	    parentPath: node.path,
	    depth: node.depth + 1,
	    synthetic: true,
	    children: [],
	};

	// --- statics ---
	for (const key of getOwnKeys(Ctor, { includeSymbols })) {
	    const name = typeof key === "symbol" ? key.toString() : String(key);
	    if (shouldSkipKey(name, { skipBuiltins })) continue;

	    const desc = Object.getOwnPropertyDescriptor(Ctor, key);
	    const type = typeFromDescriptor(desc);

	    // addressable: <ClassPath>.<key>
	    const childPath = `${node.path}.${name}`;

	    staticsFolder.children.push({
		type,
		name,
		ref: desc?.value, // for accessor this will be undefined; ok for now
		path: childPath,
		pathParts: childPath.split("."),
		parentPath: staticsFolder.path,
		depth: staticsFolder.depth + 1,
		synthetic: true,
	    });
	}

	// --- prototype (instance methods/accessors live here) ---
	const proto = Ctor.prototype;
	if (proto && typeof proto === "object") {
	    for (const key of getOwnKeys(proto, { includeSymbols })) {
		const name = typeof key === "symbol" ? key.toString() : String(key);
		if (name === "constructor") continue;
		if (shouldSkipKey(name, { skipBuiltins })) continue;

		const desc = Object.getOwnPropertyDescriptor(proto, key);
		const type = typeFromDescriptor(desc);

		// addressable: <ClassPath>.prototype.<key>
		const childPath = `${node.path}.prototype.${name}`;

		protoFolder.children.push({
		    type,
		    name,
		    ref: desc?.value,
		    path: childPath,
		    pathParts: childPath.split("."),
		    parentPath: protoFolder.path,
		    depth: protoFolder.depth + 1,
		    synthetic: true,
		});
	    }
	}

	
	//out.push(staticsFolder, protoFolder);
	out.push(protoFolder);
	for (const item of staticsFolder.children){
	    out.push(item);
	}
	return out;
    },


    // detect if its an instance of a class
    _enrichHashInstance(node, value) {
	const meta = getInstanceMeta(value);
	if (!meta) return;
	//console.log('ENRICHING INSTANCE CLASS INFO', node.name);
	node.isInstance = true;
	node.instanceClassName = meta.className;
	node.instanceCtorRef = meta.ctor;

	// Optional: if the class was already indexed somewhere, link it
	const ctorNode = this._findByRef?.(meta.ctor);
	if (ctorNode?.path) node.instanceClassPath = ctorNode.path;
    },


    _appendInstanceProtoChildren(node, value, parseOpts, opts = {}) {
	const {
	    includeSymbols = true,
	    skipBuiltins = true,
	} = opts;

	const {
	    pathParts,
	    depth,
	    seen,
	    maxDepth,
	    includeNonEnumerable,
	    includeClasses,
	} = parseOpts;

	if (!node?.path || !value) return;
	if (!node.isInstance) return;

	const own = new Set(Reflect.ownKeys(value).map(k => String(k)));

	const already = new Set();
	if (Array.isArray(node.children)) {
	    for (const c of node.children) {
		if (c?.name) already.add(String(c.name));
	    }
	}

	// add constructor link (addressable: <instPath>.constructor)
if (!already.has("constructor")) {
  const Ctor = value?.constructor;

  if (typeof Ctor === "function") {
    const ctorNode = this._parseNode({
      value: Ctor,
      name: "constructor",
      pathParts: pathParts.concat(["constructor"]),
      parentPath: node.path,
      depth: depth + 1,
      seen,
      maxDepth,
      includeNonEnumerable,
      includeClasses,
    });

    ctorNode.synthetic = true;
    ctorNode.inherited = true;
    ctorNode.ownerKind = "constructor";

    node.children.push(ctorNode);
    already.add("constructor");
  }
}

// append static members as <instPath>.constructor.<name>
const Ctor = value?.constructor;
if (typeof Ctor === "function") {
  const staticKeys = Reflect.ownKeys(Ctor);

  for (const k of staticKeys) {
    const name = typeof k === "symbol" ? k.toString() : String(k);

    // skip builtins for constructor itself
    if (name === "length" || name === "name" || name === "prototype") continue;
    if (skipBuiltins && shouldSkipKey(name, { skipBuiltins })) continue;

    // avoid duplicates (instance might already have same-named prop)
    if (own.has(name)) continue;

    // IMPORTANT: these are different pathParts (constructor namespace)
    const childPathParts = pathParts.concat(["constructor", name]);

    const desc = Object.getOwnPropertyDescriptor(Ctor, k);
    const v = desc?.value;

    const childNode = this._parseNode({
      value: v,
      name,
      pathParts: childPathParts,
      parentPath: `${node.path}.constructor`,
      depth: depth + 2,
      seen,
      maxDepth,
      includeNonEnumerable,
      includeClasses,
    });

    childNode.synthetic = true;
    childNode.isStatic = true;
    childNode.ownerKind = "static";
    childNode.via = "constructor"; // optional flag

    // Note: to keep UI clean, you may want these AFTER prototype methods
    node.children.push(childNode);
  }
}
	
	for (const { key, proto } of getProtoMembers(value, { includeSymbols })) {
	    const name = typeof key === "symbol" ? key.toString() : String(key);

	    if (name === "constructor") continue;
	    if (skipBuiltins && shouldSkipKey(name, { skipBuiltins })) continue;

	    // never shadow own props
	    if (own.has(name)) continue;
	    if (already.has(name)) continue;

	    // IMPORTANT: use the same pipeline as normal nodes
	    const desc = Object.getOwnPropertyDescriptor(proto, key);
	    const v = desc?.value;

	    const childNode = this._parseNode({
		value: v,
		name,
		pathParts: pathParts.concat([name]),
		parentPath: node.path,
		depth: depth + 1,
		seen,
		maxDepth,
		includeNonEnumerable,
		includeClasses,
	    });

	    childNode.synthetic = true;
	    childNode.inherited = true;
	    childNode.ownerKind = "prototype";

	    node.children.push(childNode);
	    already.add(name);
	}
    }
};


export default  ClassInspectorTraits ;


# --- end: ClassInspector.js ---



# --- begin: ClassInspectorConsole.js ---

/**
 * classInspector.js
 *
 * Purpose:
 * - Provide class/constructor introspection WITHOUT relying on globals.
 * - Synthesize a stable "tree view" of classes:
 *     <Class>
 *       ├─ [[static]]
 *       └─ prototype
 *
 * HARD expectations:
 * - ctx is a normal ctx object with:
 *   - ctx.TreeInspector (for icons/types elsewhere, optional here)
 *   - ctx.lib.helpers.escapeHtml (optional elsewhere; not used here)
 *
 * Notes:
 * - This file does NOT render DOM.
 * - This file does NOT mutate the inspected target/class.
 * - This file DOES "synthesize" children nodes for classes.
 */

// ------------------------------------------------------------
// Small utils
// ------------------------------------------------------------
function isFn(x) {
    return typeof x === "function";
}

function isObj(x) {
    return x !== null && (typeof x === "object" || typeof x === "function");
}

/**
 * Best-effort class detection:
 * - native/compiled classes: Function + "class " prefix
 * - user-defined ES classes: same
 *
 * This will NOT treat plain functions as classes unless they look like classes,
 * but you can override by calling expand on any function if you want.
 */
function isClassLike(fn) {
    if (!isFn(fn)) return false;
    const src = Function.prototype.toString.call(fn);
    return /^\s*class\b/.test(src);
}

/**
 * Some libraries export constructor functions (not ES class syntax).
 * If you want to treat those as "class-like", use this predicate.
 */
function isConstructorLike(fn) {
    if (!isFn(fn)) return false;
    // Heuristic: has a prototype with at least 1 own prop besides constructor
    const p = fn.prototype;
    if (!p || !isObj(p)) return false;
    const names = Object.getOwnPropertyNames(p);
    return names.some((n) => n !== "constructor");
}

function safeGetOwnPropertyDescriptor(obj, key) {
    try {
	return Object.getOwnPropertyDescriptor(obj, key);
    } catch {
	return null;
    }
}

function safeGetOwnPropertyNames(obj) {
    try {
	return Object.getOwnPropertyNames(obj) || [];
    } catch {
	return [];
    }
}

function safeGetOwnPropertySymbols(obj) {
    try {
	return Object.getOwnPropertySymbols(obj) || [];
    } catch {
	return [];
    }
}

function toKeyString(key) {
    if (typeof key === "symbol") {
	// Symbol(desc)
	return key.toString();
    }
    return String(key);
}

// ------------------------------------------------------------
// Descriptor -> "node record" mapping
// ------------------------------------------------------------
function classifyDescriptor(desc) {
    if (!desc) return { type: "unknown" };

    // accessors
    const hasGet = typeof desc.get === "function";
    const hasSet = typeof desc.set === "function";
    if (hasGet || hasSet) {
	return { type: "accessor", hasGet, hasSet };
    }

    // value property
    const v = desc.value;
    if (typeof v === "function") return { type: "function" };
    if (Array.isArray(v)) return { type: "array" };
    if (v === null) return { type: "null" };
    return { type: typeof v === "object" ? "hash" : typeof v };
}

function buildSignatureForFunction(fn, name) {
    try {
	return {
	    name: name || fn?.name || "(anonymous)",
	    arity: typeof fn?.length === "number" ? fn.length : 0,
	    params: null,
	    isNative: /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn)),
	    sourcePreview: Function.prototype.toString.call(fn).slice(0, 240),
	};
    } catch {
	return {
	    name: name || "(anonymous)",
	    arity: 0,
	    params: null,
	    isNative: true,
	    sourcePreview: "",
	};
    }
}

function previewScalar(v) {
    try {
	if (typeof v === "string") return JSON.stringify(v);
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	if (v === null) return "null";
	if (typeof v === "undefined") return "undefined";
	if (typeof v === "symbol") return v.toString();
	return null;
    } catch {
	return null;
    }
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Returns true if `ref` is something we can treat as a class node.
 * By default: ES class syntax OR constructor-like functions.
 */
function isInspectableClass(ref, { allowConstructorFunctions = true } = {}) {
    if (!isFn(ref)) return false;
    if (isClassLike(ref)) return true;
    if (allowConstructorFunctions && isConstructorLike(ref)) return true;
    return false;
}

/**
 * Generate the two synthetic top-level children for a class:
 * - [[static]]
 * - prototype
 *
 * These are "container nodes" whose ref points at:
 * - the class function itself
 * - the prototype object
 */
function getSyntheticRoots(ctx, { classRef, classPath }) {
  if (!ctx) throw new Error("[classInspector.getSyntheticRoots] ctx required");
  if (!isFn(classRef)) throw new Error("[classInspector.getSyntheticRoots] classRef must be function");
  if (!classPath) throw new Error("[classInspector.getSyntheticRoots] classPath required");

  const protoPath = `${classPath}.prototype`;

  return [
    {
      type: "hash",
      name: "prototype",
      ref: classRef.prototype,
      path: protoPath,
      pathParts: protoPath.split("."),
      parentPath: classPath,
      depth: null,
      children: [],
      synthetic: true,
      isPrototype: true,
    },
  ];
}
/*
function getSyntheticRoots(ctx, { classRef, classPath }) {
    if (!ctx) throw new Error("[classInspector.getSyntheticRoots] ctx required");
    if (!isFn(classRef)) throw new Error("[classInspector.getSyntheticRoots] classRef must be function");
    if (!classPath) throw new Error("[classInspector.getSyntheticRoots] classPath required");

    const staticPath = `${classPath}.[[static]]`;
    const protoPath = `${classPath}.prototype`;

    return [
	{
	    type: "hash",
	    name: "[[static]]",
	    ref: classRef,
	    path: staticPath,
	    pathParts: staticPath.split("."),
	    parentPath: classPath,
	    depth: null,
	    children: [], // optional; can be filled by expand step
	    synthetic: true,
	},
	{
	    type: "hash",
	    name: "prototype",
	    ref: classRef.prototype,
	    path: protoPath,
	    pathParts: protoPath.split("."),
	    parentPath: classPath,
	    depth: null,
	    children: [],
	    synthetic: true,
	},
    ];
}
*/
/**
 * Enumerate members of:
 * - the class itself (static)
 * - the prototype (instance)
 *
 * Produces child node records that "look like" TreeInspector nodes.
 */
function enumerateMembers(ctx, {
    ownerRef,
    ownerPath,
    includeSymbols = true,
    includeNonEnumerable = true, // we use getOwnPropertyNames, so yes by default
    skipBuiltins = true,
    kind, // "static" | "prototype"
}) {
    if (!ctx) throw new Error("[classInspector.enumerateMembers] ctx required");
    if (!ownerRef) throw new Error("[classInspector.enumerateMembers] ownerRef required");
    if (!ownerPath) throw new Error("[classInspector.enumerateMembers] ownerPath required");

    // keys
    const names = includeNonEnumerable ? safeGetOwnPropertyNames(ownerRef) : Object.keys(ownerRef);
    const syms = includeSymbols ? safeGetOwnPropertySymbols(ownerRef) : [];
    const keys = [...names, ...syms];

    const rows = [];

    for (const key of keys) {
	// skip noisy builtins
	if (skipBuiltins && typeof key !== "symbol") {
	    const k = String(key);
	    if (kind === "static") {
		// common function/class builtins
		if (k === "length" || k === "name" || k === "prototype") continue;
		if (k === "caller" || k === "arguments") continue;
	    }
	    if (kind === "prototype") {
		if (k === "constructor") continue;
	    }
	}

	const desc = safeGetOwnPropertyDescriptor(ownerRef, key);
	if (!desc) continue;

	const keyStr = toKeyString(key);
	const path = `${ownerPath}.${keyStr}`;

	const cls = classifyDescriptor(desc);

	// Accessors: create a node representing the property, but keep signature info for get/set
	if (cls.type === "accessor") {
	    const sigParts = [];
	    if (desc.get) sigParts.push("get");
	    if (desc.set) sigParts.push("set");
	    const label = keyStr;

	    rows.push({
		type: "accessor",
		name: label,
		ref: null,
		path,
		pathParts: path.split("."),
		parentPath: ownerPath,
		depth: null,
		signature: {
		    name: `${sigParts.join("/") || "accessor"} ${label}`,
		    arity: 0,
		    params: null,
		    isNative: false,
		    sourcePreview: "",
		},
		accessor: {
		    hasGet: !!desc.get,
		    hasSet: !!desc.set,
		    getSignature: desc.get ? buildSignatureForFunction(desc.get, `get ${label}`) : null,
		    setSignature: desc.set ? buildSignatureForFunction(desc.set, `set ${label}`) : null,
		},
		synthetic: true,
	    });

	    continue;
	}

	// Regular value property
	const v = desc.value;

	const rec = {
	    type: cls.type === "null" ? "hash" : cls.type, // keep existing UI stable
	    name: keyStr,
	    ref: v,
	    path,
	    pathParts: path.split("."),
	    parentPath: ownerPath,
	    depth: null,
	    synthetic: true,
	};

	if (typeof v === "function") {
	    rec.signature = buildSignatureForFunction(v, keyStr);
	} else {
	    const pv = previewScalar(v);
	    if (pv != null) {
		rec.valuePreview = pv;
		rec.valueKind = typeof v;
	    }
	}

	rows.push(rec);
    }

    return rows;
}

/**
 * Expand a TreeInspector "class" info object with synthetic children.
 *
 * Expected input:
 * - info: result from ctx.inspector.inspect(path, ...)
 * - info.ref should be the actual class function (or constructor)
 * - info.path is absolute
 *
 * Output:
 * - newInfo: same object (cloned shallow) with children[] filled (synthetic)
 */




function expandClassInfo(ctx, info, opts = {}) {
    if (!ctx) throw new Error("[classInspector.expandClassInfo] ctx required");
    if (!info) throw new Error("[classInspector.expandClassInfo] info required");

    const classRef = info.ref;
    const classPath = info.path;

    if (!isInspectableClass(classRef, opts)) {
	// return as-is if not treatable
	return info;
    }

    const includeSymbols = opts.includeSymbols ?? true;
    const skipBuiltins = opts.skipBuiltins ?? false; // you said "get it all" for now

    // 1) enumerate statics directly under the class path
const staticMembers = enumerateMembers(ctx, {
  ownerRef: classRef,
  ownerPath: classPath,       // <- direct
  includeSymbols,
  skipBuiltins,
  kind: "static",
}).map((n) => ({ ...n, isStatic: true }));

// 2) prototype root container
const [protoRoot] = getSyntheticRoots(ctx, { classRef, classPath });

const protoMembers = enumerateMembers(ctx, {
  ownerRef: classRef.prototype,
  ownerPath: protoRoot.path,
  includeSymbols,
  skipBuiltins,
  kind: "prototype",
});

protoRoot.children = protoMembers;

// 3) attach to info
const out = { ...info };
out.children = [...staticMembers, protoRoot];
out.childCount = out.children.length;

out.classInspector = {
  synthetic: true,
  staticCount: staticMembers.length,
  protoCount: protoMembers.length,
};

return out;
}
/*
  
function expandClassInfo(ctx, info, opts = {}) {
    if (!ctx) throw new Error("[classInspector.expandClassInfo] ctx required");
    if (!info) throw new Error("[classInspector.expandClassInfo] info required");

    const classRef = info.ref;
    const classPath = info.path;

    if (!isInspectableClass(classRef, opts)) {
	// return as-is if not treatable
	return info;
    }

    const includeSymbols = opts.includeSymbols ?? true;
    const skipBuiltins = opts.skipBuiltins ?? false; // you said "get it all" for now

    // 1) synthetic root containers
    const [staticRoot, protoRoot] = getSyntheticRoots(ctx, { classRef, classPath });

    // 2) fill their children lists
    const staticMembers = enumerateMembers(ctx, {
	ownerRef: classRef,
	ownerPath: staticRoot.path,
	includeSymbols,
	skipBuiltins,
	kind: "static",
    });

    const protoMembers = enumerateMembers(ctx, {
	ownerRef: classRef.prototype,
	ownerPath: protoRoot.path,
	includeSymbols,
	skipBuiltins,
	kind: "prototype",
    });

    staticRoot.children = staticMembers;
    protoRoot.children = protoMembers;

    // 3) attach to info
    const out = { ...info };
    out.children = [staticRoot, protoRoot];
    out.childCount = out.children.length;

    // optional metadata
    out.classInspector = {
	synthetic: true,
	staticCount: staticMembers.length,
	protoCount: protoMembers.length,
    };

    return out;
    }
    */

export {
    isInspectableClass,
    getSyntheticRoots,
    enumerateMembers,
    expandClassInfo,
};

export default {
    isInspectableClass,
    getSyntheticRoots,
    enumerateMembers,
    expandClassInfo,
};


# --- end: ClassInspectorConsole.js ---



# --- begin: collapsibleTree.js ---


/**
 * Collapsible tree renderer (absolute-path based).
 *
 * Assumptions:
 * - ctx.inspector.tree nodes include:
 *   - name, type, children[]
 *   - path (absolute) + pathParts (optional)
 * - setDetail(ctx, info) works as intended (external).
 *
 * Notes:
 * - No HTML/design changes intended; only wiring + dependency correctness.
 */

function renderCollapsibleTree(
    ctx,
    {
	root = ctx.inspector.tree,
	maxNodes = 2500,
	expandRoot = true,
    } = {}
) {
    const { treeEl, expanded } = ctx;
    const { escapeHtml, chipCss } = ctx.lib.helpers;
    const { parentPathOf, leafNameOf, goUpOne } = ctx.lib.path;

    
    treeEl.innerHTML = "";

    if (!root) {
	treeEl.textContent = "No tree. (parse failed?)";
	return;
    }

    // Absolute expansion key (fallback to name only if needed)
    const rootPath = root.path || root.name;
    const stem       = leafNameOf(rootPath);
    if (expandRoot && rootPath) expanded.add(rootPath);

    const head = document.createElement("div");
    head.style.cssText =
	"margin-bottom:8px; opacity:0.9; display:flex; gap:8px; align-items:center;";

    head.innerHTML = `
     <!--
     <span style="opacity:0.9;">
       root:
       <span style="opacity:1; font-weight:700;">${escapeHtml(rootPath)}</span>
     </span>
     -->
     <span style="opacity:0.7; margin-left:6px;">
       <!--stem:--><span style="opacity:1; font-weight:700;">${escapeHtml(stem || "")}</span>
     </span>

     <button data-expandall style="${chipCss()}">expand all</button>
     <button data-collapseall style="${chipCss()}">collapse all</button>
   `;
   /* 
    head.innerHTML = `
    <span style="opacity:0.9;">
      root: <span style="opacity:1; font-weight:700;">${escapeHtml(rootPath)}</span>
    </span>
    <button data-expandall style="${chipCss()}">expand all</button>
    <button data-collapseall style="${chipCss()}">collapse all</button>
  `;
   */
    treeEl.appendChild(head);

    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none; padding-left: 0; margin:0;";
    treeEl.appendChild(ul);
    appendTreeNavTop(ctx, rootPath, ul);
    // DFS; paths are absolute now (node.path)
    const stack = [{ node: root, path: rootPath, depth: 0 }];
    let count = 0;

    while (stack.length && count < maxNodes) {
	const { node, path, depth } = stack.pop();
	count++;
	const isBranch = isBranchNode(node);
	//const isBranch = !!node && (node.type === "hash" || node.type === "array");
	const isOpen = isBranch && expanded.has(path);
	const kids = node?.children || [];

	ul.appendChild(renderTreeRow(ctx, { node, path, depth, maxNodes }));

	if (isBranch && isOpen && kids.length) {
	    for (let i = kids.length - 1; i >= 0; i--) {
		const child = kids[i];
		const childPath = child?.path || `${path}.${child.name}`; // fallback only
		stack.push({ node: child, path: childPath, depth: depth + 1 });
	    }
	}
    }

    if (count >= maxNodes) {
	const warn = document.createElement("div");
	warn.style.cssText = "margin-top:8px; opacity:0.7;";
	warn.textContent = `…stopped at ${maxNodes} rendered nodes. Expand less / use find.`;
	treeEl.appendChild(warn);
    }

    // expand/collapse all
    const expandAllBtn = head.querySelector("[data-expandall]");
    if (expandAllBtn) {
	expandAllBtn.onclick = () => {
	    expandAllUnder(ctx, root, rootPath, 5000);
	    renderCollapsibleTree(ctx, { root, maxNodes, expandRoot: false });
	};
    }

    const collapseAllBtn = head.querySelector("[data-collapseall]");
    if (collapseAllBtn) {
	collapseAllBtn.onclick = () => {
	    expanded.clear();
	    if (rootPath) expanded.add(rootPath);
	    renderCollapsibleTree(ctx, { root, maxNodes, expandRoot: false });
	};
    }

    // show root details
    ctx.lib.path.showPath(ctx, rootPath);
}


// ---------- Render helpers (optional; kept for compatibility) ----------
function renderTree(ctx) {
    const { inspector, treeEl } = ctx;
    const { escapeHtml, chipCss} = ctx.lib.helpers;
    treeEl.innerHTML = "";

    const root = inspector.tree;
    if (!root) {
	treeEl.textContent = "No tree. (parse failed?)";
	return;
    }

    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none; padding-left:0; margin:0;";

    // root line
    ul.appendChild(
	renderNodeLine(ctx, {
	    label: root.name,
	    type: root.type,
	    type: root?.isStatic??false,
	    path: root.path || root.name,
	    faint: false,
	    node: root
	})
    );

    // first-level children
    for (const child of root.children || []) {
	const childPath = child.path || `${root.path || root.name}.${child.name}`;
	ul.appendChild(
	    renderNodeLine(ctx, {
		label: child.name,
		type: child.type,
		isStatic: child?.isStatic??false,
		path: childPath,
		faint: false,
		node:child
	    })
	);
    }

    treeEl.appendChild(ul);
    ctx.lib.path.showPath(ctx, root.path || root.name);
}

function renderNodeLine(ctx, { label, type, path, faint = false,node=null }) {
    const { escapeHtml, chipCss, iconFor } = ctx.lib.helpers;
    const li = document.createElement("li");
    li.style.cssText = `
      color: yellow;
      padding: 4px 6px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      ${faint ? "opacity:0.92;" : ""}
    `;

    li.onmouseenter = () => {
	li.style.background = "rgba(255,255,255,0.08)";
    };
    li.onmouseleave = () => {
	li.style.background = "transparent";
    };

    li.onclick = () => ctx.lib.path.showPath(ctx, path);

    const icon = iconFor(ctx,type,node);
    li.innerHTML = `<span style="opacity:0.95">${icon}</span> <span>${escapeHtml(
    label
  )}</span>`;

    return li;
}

// expands nodes under a given node (bounded to avoid infinite/huge blowups)
function expandAllUnder(ctx, node, path, limit = 5000) {
    const { escapeHtml, chipCss} = ctx.lib.helpers;
    const { expanded } = ctx;

    const stack = [{ node, path }];
    let count = 0;

    while (stack.length && count < limit) {
	const cur = stack.pop();
	if (!cur?.node) continue;
	const isBranch = isBranchNode(node);
	//const isBranch = cur.node.type === "hash" || cur.node.type === "array";
	if (!isBranch) continue;

	expanded.add(cur.path);
	count++;

	const kids = cur.node.children || [];
	for (let i = kids.length - 1; i >= 0; i--) {
	    const child = kids[i];
	    const childPath = child?.path || `${cur.path}.${child.name}`; // prefer absolute
	    stack.push({ node: child, path: childPath });
	}
    }
}

function renderTreeRow(ctx, { node, path, depth, maxNodes }) {
    const { escapeHtml, chipCss, iconFor} = ctx.lib.helpers;
    const { expanded } = ctx;

    const isBranch = isBranchNode(node);
    //const isBranch = !!node && (node.type === "hash" || node.type === "array");
    const isOpen = isBranch && expanded.has(path);

    const li = document.createElement("li");
    li.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
    padding: 4px 6px;
    border-radius: 8px;
    cursor: default;
    user-select: none;
    color:yellow;
  `;
    li.style.paddingLeft = `${6 + depth * 12}px`;

    li.onmouseenter = () => (li.style.background = "rgba(255,255,255,0.08)");
    li.onmouseleave = () => (li.style.background = "transparent");

    const toggle = (e) => {
	e?.stopPropagation?.();
	if (!isBranch) return;

	if (expanded.has(path)) expanded.delete(path);
	else expanded.add(path);

	renderCollapsibleTree(ctx, {
	    root: ctx.inspector.tree,
	    maxNodes,
	    expandRoot: false,
	});
    };

    // twisty
    const twisty = document.createElement("span");
    twisty.style.cssText = `
    width: 16px;
    display:inline-flex;
    justify-content:center;
    opacity: ${isBranch ? 0.9 : 0.25};
    cursor: ${isBranch ? "pointer" : "default"};
  `;
    twisty.textContent = isBranch ? (isOpen ? "▼" : "▶") : "•";
    if (isBranch) twisty.onclick = toggle;

    // icon
    const icon = document.createElement("span");
    icon.style.cssText = "opacity:0.95;";
    icon.textContent = iconFor(ctx,node.type,node);

    // label (inspect)
    const label = document.createElement("span");
    label.style.cssText = "cursor:pointer;";
    label.textContent = node.name;

    label.onclick = (e) => {
	e.stopPropagation();
	ctx.lib.path.showPath(ctx, path);
    };

    // dblclick toggles branch
    label.ondblclick = toggle;

    li.appendChild(twisty);
    li.appendChild(icon);
    li.appendChild(label);

    // small child count hint
    if (isBranch) {
	const hint = document.createElement("span");
	hint.style.cssText = "opacity:0.55; margin-left:6px;";
	const n = Array.isArray(node.children) ? node.children.length : 0;
	hint.textContent = n ? `(${n})` : "";
	li.appendChild(hint);
    }

    return li;
}


function appendTreeNavTop(ctx, rootPath, ul){
    // --- "up one dir" row (../ + parent path as text) ---


    const parentPath = ctx.lib.path.parentPathOf(rootPath); // "abs path minus stem"
    if(!parentPath) return;

	const liUp = document.createElement("li");
	liUp.style.cssText = `
        display:flex;
        align-items:center;
        gap:10px;
        padding: 4px 6px;
        border-radius: 8px;
        user-select: none;
        color: yellow;
        opacity: 0.95;
        `;

	const upBtn = document.createElement("span");
	upBtn.style.cssText = `
          cursor: pointer;
         font-weight: 700;
        `;
	upBtn.textContent = "../";
	upBtn.onclick = (e) => {
	    e.stopPropagation();
	    ctx.lib.path.goUpOne(ctx);                  // path-based navigation
	    // NOTE: goUpOne should call setRootFromInput which re-renders already.
	    // If not, you can force:
	    // renderCollapsibleTree(ctx, { expandRoot: true });
	};

	const upText = document.createElement("span");
	upText.style.cssText = "opacity:0.65;";
	upText.textContent = parentPath;

	liUp.appendChild(upBtn);
	liUp.appendChild(upText);

	liUp.onmouseenter = () => (liUp.style.background = "rgba(255,255,255,0.08)");
	liUp.onmouseleave = () => (liUp.style.background = "transparent");

	ul.appendChild(liUp);

}

// helper (local)
function isBranchNode(node) {
    if (!node) return false;
    return node.type === "hash" || node.type === "array" || node.type === "class";
}

export { renderCollapsibleTree,renderNodeLine };
export default {renderCollapsibleTree,renderNodeLine};


# --- end: collapsibleTree.js ---



# --- begin: console.js ---

import detail     from "./detail.js";          // cleaned
import events     from "./events.js";          // cleaned
import helpers    from "./helpers.js";         // cleaned
import root       from "./root.js";            // cleaned
import tree       from "./collapsibleTree.js"; // cleaned
import context    from "./context.js";         // cleaned
import dom        from "./dom.js";             // cleaned
import finder     from "./finder.js";          // cleaned
import path       from "./path.js";            // cleaned
import toggle     from "./toggle.js";          // cleaned
import class_inspector     from "./ClassInspectorConsole.js";  // cleaned

let TreeInspector = null;

//leaving it in the main file b/c dont want to hide it
function installLibs(ctx = {}) {
    if (!TreeInspector) throw new Error("[install] TreeInspector not installed");
    if (!ctx || typeof ctx !== "object") throw new Error("[install] ctx must be an object");

    ctx.lib ||= {};
    ctx.TreeInspector = TreeInspector;
    Object.assign(ctx.lib, {
	detail,
	events,
	helpers,
	root,
	tree,
	context,
	dom,
	finder,
	path,
	toggle,
	class_inspector
    });

    return ctx;
}


function install(cls) {
    TreeInspector = cls;
}

function openConsole(
    target,
    {
	mount = document.body,
	title = "m7 Tree Console",
	maxDepth = 25,
	rootScope = globalThis,
	eventScope = null,
    } = {}
) {
    if (!eventScope) eventScope = rootScope;

    const ctx = installLibs({});

    ctx.lib.context.build(ctx, {
	target,
	mount,
	title,
	maxDepth,
	rootScope,
	eventScope,
    });

    ctx.lib.events.bindConsoleUI(ctx);
    ctx.lib.tree.renderCollapsibleTree(ctx);

    return { inspector: ctx.inspector, el: ctx.el };
}








///
/*
  function openConsole(
  target,
  {
  mount = document.body,
  title = "m7 Tree Console",
  maxDepth = 25,
  global = window,   // explicit global root
  } = {}
  ) {

  if (target == null) throw new Error("[tree.console] target is required");
  if (!TreeInspector) throw new Error("[console] TreeInspector not installed");

  const uiName = "root";

  const inspector = new TreeInspector(target, {
  autoParse: false,
  hint: uiName,
  global,
  });

  inspector.parse({ maxDepth });

  const expanded = new Set();
  const rootPath = inspector.tree?.path || inspector._absRootPath || uiName;
  if (rootPath) expanded.add(rootPath);

  // 👇 global context gen
  const ctx = makeConsoleContext({
  mount,
  title,
  inspector,
  expanded,
  maxDepth,
  global,
  uiName,
  });
  //we'll work this next ... just focus on the boiler plate first
  setupStaticConsoleEvents({
  el,  mount,  inspector, expanded
  qEl,  detailEl,
  treeBtn,  setRootBtn,
  renderCollapsibleTree,  renderFullTree,  renderFindResults,	setDetail,
  reparseCurrentRoot,	setRootFromInput
  });

  //renderFullTree();
  renderCollapsibleTree();
  return { inspector, el };

  
  // all functions after this
  // ----- back or up dir ----

  function isBaseVarRoot() {
  return (
  BASE_VARS.has(currentRootName) ||
  (typeof window === "object" && window.lib && currentRoot === window.lib)
  );
  }
  
  function canGoUp() {
  // never show ../ when at window/globalThis
  if (currentRoot === window || currentRoot === globalThis) return false;

  // allow if we have history, or if we're at a base var (lib -> window)
  if (rootStack.length > 0) return true;
  //if (BASE_VARS.has(currentRootName)) return true;
  if (parentPathOf(currentRootPath)) return true;   // can go up if path has a parent
  if (currentRoot !== defaultRoot) return true;     // otherwise allow fallback-to-window
  return false;
  }

  function goUpOne() {
  // 1) history pop (works when you pushed path)
  if (rootStack.length > 0) {
  const prev = rootStack.pop();
  setRoot(prev.value, prev.label, { pushHistory: false, path: prev.path });
  return;
  }

  // 2) compute parent from absolute path (THIS is the missing piece)
  const upPath = parentPathOf(currentRootPath);
  if (upPath) {
  const upVal = resolveRootSelector(upPath);
  if (upVal != null) {
  setRoot(upVal, leafNameOf(upPath), { pushHistory: false, path: upPath });
  return;
  }
  }

  // 3) last fallback: if you're at your initial root, go to defaultRoot (window)
  if (currentRoot !== defaultRoot && defaultRoot != null) {
  setRoot(defaultRoot, defaultRootName, { pushHistory: false, path: defaultRootName });
  }
  }
  
  
  // ----- root switching ----
  function setRoot(newRoot, name = null, { pushHistory = true, fallbackToDefault = true, path = null } = {}) {
  if (newRoot == null) return false;

  // reject scalars early (prevents "locked" roots)
  const tt = typeof newRoot;
  const rootable = newRoot && (tt === "object" || tt === "function");
  if (!rootable) return false;

  // snapshot current known-good state
  const prev = {
  root: currentRoot,
  name: currentRootName,
  path: currentRootPath,     // ✅ ADD
  tree: inspector.tree,
  stackLen: rootStack.length,
  };

  const nextName = (name ?? inferRootName(newRoot, { fallback: "root" })) || "root";
  const nextPath = path ?? nextName; // ✅ ADD (fallback to label)

  try {
  // Attempt parse WITHOUT committing history/state yet
  inspector.rootRef = newRoot;
  inspector.options = inspector.options || {};
  inspector.options.name = nextName;

  inspector.parse({ name: nextName, maxDepth });

  // parse succeeded but still validate tree
  if (!inspector.tree) throw new Error("parse produced null tree");

  // Commit history only after success
  if (pushHistory && prev.root && prev.root !== newRoot) {
  rootStack.push({ value: prev.root, label: prev.name, path: prev.path }); // ✅ ADD path
  }

  // Commit current state
  currentRoot = newRoot;
  currentRootName = nextName;
  currentRootPath = nextPath; // ✅ ADD

  expanded.clear();
  expanded.add(currentRootName);

  renderCollapsibleTree();
  return true;

  } catch (err) {
  // Revert to previous known-good state
  currentRoot = prev.root;
  currentRootName = prev.name;
  currentRootPath = prev.path; // ✅ ADD

  inspector.rootRef = prev.root;
  inspector.options = inspector.options || {};
  inspector.options.name = prev.name;

  // restore stack length if we ever changed it (we shouldn't now, but safe)
  while (rootStack.length > prev.stackLen) rootStack.pop();

  // If previous tree existed, keep it; otherwise fall back to default root automatically
  if (prev.tree) {
  inspector.tree = prev.tree; // keep last good tree in memory
  } else if (fallbackToDefault) {
  // last resort: return home silently
  try {
  inspector.rootRef = defaultRoot;
  inspector.options.name = defaultRootName;
  inspector.parse({ name: defaultRootName, maxDepth });
  currentRoot = defaultRoot;
  currentRootName = defaultRootName;
  currentRootPath = defaultRootName; // ✅ ADD (or "window" etc if you prefer)
  } catch {}
  }

  // Re-render whatever state we have
  expanded.clear();
  expanded.add(currentRootName || "root");
  renderCollapsibleTree();

  // optional: show a small note instead of hard failure
  setDetail?.({ error: `Cannot set root: ${String(err?.message || err)}` });

  return false;
  }
  }
  
  

  function resolveRootSelector(selector) {
  const s = String(selector || "").trim();
  if (!s) return null;

  // allow "window" / "globalThis" / "lib" / "window.lib.utils"
  const base = globalThis; // browsers: window === globalThis

  // If they type a bare word like "lib", try:
  // 1) current root child
  // 2) globalThis child
  // 3) dot path from globalThis
  if (!s.includes(".")) {
  if (currentRoot && s in currentRoot) return currentRoot[s];
  if (s in base) return base[s];
  }

  // Dot path: walk from globalThis first (covers "window.lib", "lib.site", etc)
  const parts = s.split(".").filter(Boolean);
  let obj = base;

  for (const p of parts) {
  if (obj == null) return null;
  try {
  obj = obj[p];
  } catch {
  return null;
  }
  }

  return obj;
  }
  
  // ---------- Render ----------

  function renderFindResults(q, hits) {
  treeEl.innerHTML = "";
  const head = document.createElement("div");
  head.style.cssText = "margin-bottom:8px; opacity:0.9;";
  head.textContent = `find "${q}" → ${hits.length} hits`;
  treeEl.appendChild(head);

  const ul = document.createElement("ul");
  ul.style.cssText = "list-style:none; padding-left: 0; margin:0;";

  hits.forEach(h => {
  const li = renderNodeLine(h.path, h.type, h.path, true);
  ul.appendChild(li);
  });

  treeEl.appendChild(ul);
  }

  









  


  function inferRootName(value, {
  prefer = ["__name", "__id", "name"],
  globals = true,
  fallback = "root",
  } = {}) {
  if (!value) return fallback;

  // 1) Explicit metadata on the object itself
  for (const key of prefer) {
  try {
  if (typeof value[key] === "string" && value[key]) {
  return value[key];
  }
  } catch {}
  }

  // 2) Best-effort: scan window globals (only if allowed)
  if (globals && typeof window === "object") {
  try {
  for (const k of Object.keys(window)) {
  if (window[k] === value) return k;
  }
  } catch {}
  }

  // 3) Constructor / function name (least reliable, but helpful)
  try {
  if (typeof value === "function" && value.name) return value.name;
  if (value?.constructor?.name && value.constructor.name !== "Object") {
  return value.constructor.name;
  }
  } catch {}

  return fallback;
  }





  
  }

*/

export {install,openConsole};
export default {install,console:openConsole};


# --- end: console.js ---



# --- begin: context.js ---

// context.js
function build(ctx, { target, mount, title, maxDepth, rootScope, eventScope }) {
  if (!ctx || typeof ctx !== "object") throw new Error("[context.build] ctx must be an object");
  if (target == null) throw new Error("[tree.console] target is required");
  if (!ctx.TreeInspector) throw new Error("[console] TreeInspector not installed");

  if (!rootScope) rootScope = globalThis;
  if (!eventScope) eventScope = rootScope;

  const uiName = "root";
  const inspector = new ctx.TreeInspector(target, {
    autoParse: false,
    hint: uiName,
    global: rootScope,
  });
  inspector.parse({ maxDepth });

  const expanded = new Set();
  const rootPath = inspector?.tree?.path || inspector?._absRootPath || uiName;
  if (rootPath) expanded.add(rootPath);

  // (path.js expects stable names)
  const rootScopeName =
    (typeof window !== "undefined" && rootScope === window) ? "window"
    : (typeof globalThis !== "undefined" && rootScope === globalThis) ? "globalThis"
    : "globalThis";

  const currentRootPath = rootPath;

  // ---- DOM ----
  const el = document.createElement("div");

  // bind these BEFORE dom/toggle because they read ctx.el/ctx.title/ctx.eventScope
  ctx.el = el;
  ctx.title = title;
  ctx.rootScope = rootScope;
  ctx.eventScope = eventScope;

  ctx.lib.dom.buildConsole(ctx);
  ctx.lib.toggle.enable(ctx);

  const treeEl     = el.querySelector("[data-tree]");
  const detailEl   = el.querySelector("[data-detail]");
  const qEl        = el.querySelector("[data-q]");
  const treeBtn    = el.querySelector("[data-treeview]");
  const setRootBtn = el.querySelector("[data-setroot]");
  const searchBtn  = el.querySelector("[data-search]");
  const reparseBtn = el.querySelector("[data-reparse]");
  const closeBtn   = el.querySelector("[data-close]");

  const extra = {
    target,
    mount,
    title,
    maxDepth,
    rootScope,
    eventScope,
    rootScopeName,
    uiName,

    inspector,
    expanded,
    rootPath,
    currentRootPath,

    el,
    treeEl,
    detailEl,
    qEl,
    treeBtn,
    setRootBtn,
    searchBtn,
    reparseBtn,
    closeBtn,
  };

  return Object.assign(ctx, extra);
}

export { build };
export default { build };


# --- end: context.js ---



# --- begin: detail.js ---

// detail.js

/**
 * detail.js
 * Renders the right-side detail panel and wires local interactions.
 *
 * HARD expectations (ctx):
 * - ctx.detailEl: HTMLElement
 * - ctx.inspector: TreeInspector instance
 * - ctx.lib.helpers: { iconFor, chipCss, escapeHtml, escapeAttr }
 * - ctx.lib.root.setRootFromInput(ctx, absPathString): boolean
 * - ctx.lib.path.goUpOne(ctx): boolean (optional; if missing, ../ is hidden)
 *
 * Notes:
 * - info.path is expected to be ABSOLUTE (TreeInspector provides it).
 * - child chips prefer child.path, else `${info.path}.${child.name}`.
 */

// ----------------------------
// Main
// ----------------------------
function setDetail(ctx, info) {

    const { detailEl } = ctx;
    const { iconFor, chipCss, escapeHtml, escapeAttr} = ctx.lib.helpers;

    
    if (info?.error) {
	detailEl.innerHTML = `<div style="color:#ffb3b3;">${escapeHtml(info.error)}</div>`;
	return;
    }

    if (info?.note) {
	detailEl.innerHTML = `<div style="opacity:0.9;">${escapeHtml(info.note)}</div>`;
	return;
    }

    
    const icon = iconFor(ctx, info.type,info);
    const sig = info.signature;

    ctx.detailPath = info?.canonicalPath || info?.refPath || info?.path || null;
    const canonicalPath = info.canonicalPath || info.refPath || null;
    const showCanonical =
	  info.type === "ref" &&
	  canonicalPath &&
	  canonicalPath !== info.path;
    
    detailEl.innerHTML = `
    <div style="opacity:0.8;margin-bottom:5px"  >${escapeHtml(info.path)} <button data-copy-path style="${chipCss()};padding:0 5px;">⧉</button> </div>

${
  showCanonical
    ? `
  <div style="
    margin: 8px 0 10px;
    padding: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: rgba(255,255,255,0.05);
  ">
    <div style="opacity:0.8; margin-bottom:6px;">points to</div>
    <button
      data-canonical-path="${escapeAttr(canonicalPath)}"
      style="${chipCss()}"
    >
      ${escapeHtml(canonicalPath)}
    </button>
  </div>
  `
    : ""
}

 
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
      <div style="font-size:18px;">${icon}</div>
      <div>
        <div style="font-weight:700;">${escapeHtml(info.name)}</div>
        <div style="opacity:0.75;">
          type: ${escapeHtml(info.type)}
          ${info.childCount ? ` • children: ${info.childCount}` : ""}
        </div>
      </div>

      <button data-up-root style="${chipCss()}">../</button>
      ${
        info?.ref && (info.type === "hash" || info.type === "array")
          ? `<button data-use-root style="${chipCss()}">🎯</button>`
          : ""
      }
    </div>

    ${
      sig
        ? `
	<div style="margin:10px 0; padding:8px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; background:rgba(255,255,255,0.05);">
        <div style="opacity:0.8; margin-bottom:6px;">signature</div>
        <div><b>${escapeHtml(sig.name || "(anonymous)")}</b> (${escapeHtml(
            (sig.params || []).join(", ")
        )})</div>
        <div style="opacity:0.75;">arity: ${sig.arity}${sig.isNative ? " • native" : ""}</div>
	</div>
	`
        : ""
    }

    ${
      sig?.sourcePreview
        ? `
	<div style="margin:10px 0; padding:8px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; background:rgba(255,255,255,0.05);">
        <div style="opacity:0.8; margin-bottom:6px;">source preview</div>
        <pre style="white-space:pre-wrap; margin:0;">${escapeHtml(sig.sourcePreview)}</pre>
	</div>
	`
        : ""
    }

    ${
      info?.valuePreview
        ? `
	<div style="
        margin:10px 0;
        padding:8px;
        border:1px solid rgba(255,255,255,0.12);
        border-radius:10px;
        background:rgba(255,255,255,0.05);
      ">
        <div style="opacity:0.8; margin-bottom:6px;">value <button data-copy-value style="${chipCss()};padding:0 5px;">⧉</button></div>
        <div style="white-space:pre-wrap;">${escapeHtml(info.valuePreview)}</div>
	</div>
	`
        : ""
    }

    ${
      Array.isArray(info.children) && info.children.length
        ? `
	<div style="margin-top:10px;">
        <div style="opacity:0.8; margin-bottom:6px;">children</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
        ${info.children
          .slice(0, 60)
          .map((c) => {
              const childPath = c?.path || `${info.path}.${c.name}`;
              return `
                <button data-path="${escapeAttr(childPath)}" style="${chipCss()}">
                  ${escapeHtml(iconFor(ctx, c.type,c))} ${escapeHtml(c.name)}
                </button>
              `;
          })
          .join("")}
    </div>
	</div>
	`
        : `<div style="opacity:0.7;">(no children)</div>`
    }
  `;

    wireDetailEvents(ctx, info);
}


// ----------------------------
// Local inspect helper (detail.js local)
// ----------------------------
function synthetic_inspectAndShow(ctx, path) {
    const p = String(path || "").trim();
    if (!p) {
	setDetail(ctx, { error: "Not found: (empty path)" });
	return false;
    }

    let info = ctx.inspector.inspect(p, {
	includeRef: true,
	includeChildren: true,
	show: false,
    });

    if (!info) {
	setDetail(ctx, { error: `Not found: ${p}` });
	return false;
    }

    // Class expansion hook (class defs + class-like functions)
    if (0) { //disable
    if (info.ref) {
	const isClass =
	      info.type === "class" ||
	      (info.type === "function" &&
               ctx.lib.class_inspector.isInspectableClass(info.ref));

	if (isClass) {
	    info = ctx.lib.class_inspector.expandClassInfo(ctx, info, {
		includeSymbols: true,
		skipBuiltins: false,
	    });
	}
    }
    }

    setDetail(ctx, info);
    return true;
}

// ----------------------------
// Local inspect helper
// ----------------------------
function inspectAndShow(ctx, path) {
    const p = String(path || "").trim();
    if (!p) {
	setDetail(ctx, { error: "Not found: (empty path)" });
	return false;
    }
    /*
      const info = ctx.inspector.inspect(p, {
      includeRef: true,
      includeChildren: true,
      show: false,
      });*/
    let info = ctx.inspector.inspect(p, { includeRef:true, includeChildren:true, show:false });
    /*
    if (info && (info.type === "class" || (info.type === "function" && ctx.lib.class_inspector.isInspectableClass(info.ref)))) {
	info = ctx.lib.class_inspector.expandClassInfo(ctx, info, {
	    includeSymbols: true,
	    skipBuiltins: false, // “get it all”
	});
    }
    */
    ctx.lib.detail.set(ctx, info);
    

    if (!info) {
	setDetail(ctx, { error: `Not found: ${p}` });
	return false;
    }

    setDetail(ctx, info);
    return true;
}

// ----------------------------
// Wiring
// ----------------------------
function wireDetailEvents(ctx, info) {
    const { detailEl } = ctx;

    const copyPathBtn = detailEl.querySelector("[data-copy-path]");
    if(copyPathBtn){
	copyPathBtn.onclick = async () => {
	    ctx.lib.helpers.copyToClipboard(info.path);
	}
    }
    const copyValueBtn = detailEl.querySelector("[data-copy-value]");
    if(copyValueBtn){
	copyValueBtn.onclick = async () => {
	    ctx.lib.helpers.copyToClipboard(info.valuePreview);
	}
    }
    
    // 🎯 set target (re-root to current node, by ABSOLUTE PATH)
    const useRootBtn = detailEl.querySelector("[data-use-root]");
    if (useRootBtn) {
	useRootBtn.onclick = () => {
	    const ok = ctx.lib.root.setRootFromInput(ctx, info.path);
	    if (!ok) setDetail(ctx, { error: `Not found / not rootable: ${info.path}` });
	};
    }

    /*
    // ../ up one dir (optional)
    const upRootBtn = detailEl.querySelector("[data-up-root]");
    if (upRootBtn) {
	const goUpOne = ctx.lib.path.goUpOne;
	upRootBtn.onclick = () => goUpOne(ctx);

    }
    */

    const upRootBtn = detailEl.querySelector("[data-up-root]");
    const parentPathOf = ctx.lib.path.parentPathOf;

    upRootBtn.onclick = () => {
	const root = String(ctx.currentRootPath || ctx.rootPath || "").trim();
	const cur  = String(ctx.detailPath || info?.canonicalPath || info?.refPath || info?.path || "").trim();
	if (!root || !cur) return;

	const up = parentPathOf(cur);
	if (!up) return;

	const inRoot = (up === root) || up.startsWith(root + ".");
	if (!inRoot) {
	    alert(`already at root: '${root}'. Use tree nav ../ or set a new path`);
	    //setDetail(ctx, { note: `At root: ${root}` }); 
	    return;
	}

	inspectAndShow(ctx, up);
    };
    /*
    const upRootBtn = detailEl.querySelector("[data-up-root]");
    const parentPathOf = ctx.lib.path.parentPathOf;

    upRootBtn.onclick = () => {
	const cur = String(ctx.detailPath || "").trim();
	const up = parentPathOf(cur);
	if (!up) return;
	inspectAndShow(ctx, up);
	};
    */
    
    // child chips -> inspect
    detailEl.querySelectorAll("button[data-path]").forEach((btn) => {
	btn.onclick = () => inspectAndShow(ctx, btn.getAttribute("data-path"));
    });
    
    //  canonical ref jump
    const canonicalBtn = detailEl.querySelector("[data-canonical-path]");
    if (canonicalBtn) {
	canonicalBtn.onclick = () => {
	    const p = canonicalBtn.getAttribute("data-canonical-path");
	    if (p) inspectAndShow(ctx, p);
	};
    }
    
}

export { setDetail as set };
export default { set: setDetail };


# --- end: detail.js ---



# --- begin: dom.js ---

function buildConsole(ctx){
    const {el,title} = ctx;
    const { escapeHtml, btnCss } = ctx.lib.helpers;
    el.style.cssText = `
           position: fixed; right: 12px; bottom: 12px;
           width: 780px; height: 520px;
           background: rgba(20,20,20,0.92);
           color: #eee; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
           border: 1px solid rgba(255,255,255,0.15);
           border-radius: 10px;
           box-shadow: 0 10px 30px rgba(0,0,0,0.35);
           overflow: hidden;
           z-index: 999999;
        `;

    el.innerHTML = `
           <!-- HEADER -->
           <div data-head
              style="display:flex; align-items:center; gap:10px; padding:10px 12px;
              border-bottom:1px solid rgba(255,255,255,0.12);">
              <div style="font-weight:700;">${escapeHtml(title)}</div>
                <button data-treeview title="tree view" style="${btnCss()}">🌳</button>
                <button data-setroot title="use input as root" style="${btnCss()}">🎯</button> <!-- set target -->
                <button data-reparse style="${btnCss()}">🔄</button> <!-- reparse -->

                <input data-q placeholder="find… (name or path)" style="
                  flex:1; min-width:200px; background: rgba(255,255,255,0.08); color:#fff;
                  border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
                  padding: 6px 8px; outline: none;
                "/>

                <button data-search style="${btnCss()}">🔍</button>
                <button data-close style="${btnCss()}">×</button>
              </div>

           <!-- BODY -->
           <div data-body
              style="display:grid; grid-template-columns: 1.1fr 1fr;
              height: calc(100% - 46px);">
              <div data-tree
                 style="overflow:auto; padding:10px 12px; max-height:80vh;
                 border-right:1px solid rgba(255,255,255,0.12);">
              </div>
              <div data-detail
                   style="overflow:auto; padding:10px 12px;">
             </div>
          </div>
        `;
}


export {buildConsole};
export default {buildConsole};


# --- end: dom.js ---



# --- begin: events.js ---

function bindConsoleUI(ctx) {
  const {
    el,
    mount,
    inspector,
    qEl,
    treeBtn,
    setRootBtn,
    searchBtn,
    reparseBtn,
    closeBtn,
  } = ctx;

  // pull deps from ctx.lib (no globals, no guards)
  const renderCollapsibleTree = ctx.lib.tree.renderCollapsibleTree;
  const renderFindResults     = ctx.lib.finder.renderFindResults;
  const setDetail             = ctx.lib.detail.set;
  const reparseCurrentRoot    = ctx.lib.root.reparseCurrentRoot;
  const setRootFromInput      = ctx.lib.root.setRootFromInput;
  const disableToggle         = ctx.lib.toggle.disable;

  // tree view (collapsible is default)
  treeBtn.onclick = () => renderCollapsibleTree(ctx);

  // close
  closeBtn.onclick = () => {
    disableToggle(ctx);
    el.remove();
  };

  // reparse current root
  reparseBtn.onclick = () => {
    reparseCurrentRoot(ctx);
    setDetail(ctx, { note: "Re-parsed." });
  };

  // search
  const searchFunc = () => {
    const q = String(qEl.value || "").trim();
    if (!q) return;

    const hits = inspector.find(q, { match: "both", limit: 80 });
    renderFindResults(ctx, q, hits);
  };

  searchBtn.onclick = searchFunc;

  qEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      searchFunc();
    }
  });

  // set root from input (Ctrl/Cmd+Enter or button)
  const setRootFunc = () => {
    const s = String(qEl.value || "").trim();
    if (!s) return;

    const ok = setRootFromInput(ctx, s);
    if (!ok) setDetail(ctx, { error: `Not found / not rootable: ${s}` });
  };

  setRootBtn.onclick = setRootFunc;

  qEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setRootFunc();
    }
  });

  // mount once
  mount.appendChild(el);
}

export { bindConsoleUI };
export default { bindConsoleUI };


# --- end: events.js ---



# --- begin: finder.js ---

function renderFindResults(ctx, q, hits) {
  const { treeEl } = ctx;

  treeEl.innerHTML = "";

  const head = document.createElement("div");
  head.style.cssText = "margin-bottom:8px; opacity:0.9;";
  head.textContent = `find "${q}" → ${hits.length} hits`;
  treeEl.appendChild(head);

  const ul = document.createElement("ul");
  ul.style.cssText = "list-style:none; padding-left:0; margin:0;";

  hits.forEach(h => {
    const li = ctx.lib.tree.renderNodeLine(ctx, {
      label: h.path,
      type: h.type,
      path: h.path,
	faint: true,
	node: h
    });
    ul.appendChild(li);
  });

  treeEl.appendChild(ul);
}

export { renderFindResults };
export default { renderFindResults };


# --- end: finder.js ---



# --- begin: helpers.js ---

function iconFor(ctx, type,opts = {}) {
    if(opts === null || typeof opts !=='object') opts = {};
    const {isStatic=false,isInstance=false} =opts;
    const ICONS = ctx.TreeInspector?.ICONS;
    if (!ICONS) throw new Error("[helpers.iconFor] ctx.TreeInspector.ICONS missing");
    
    const base =  (
	ICONS[type] ??
	    (["string", "number", "boolean", "undefined", "symbol", "bigint"].includes(type)
	     ? ICONS.scalar
	     : ICONS.scalar)
    );
    // consider 
    //const staticMarker = "Ⓢ`";
    const staticMarker = "⚡";
    //const instanceMarker = "Ⓘ";
    const instanceMarker = "📦";//boxunicode
    //const instanceMarker = "&#128230;"; //box entity
    if (isStatic)
	return `${staticMarker} ${base}`;
    if(isInstance)
	return `${instanceMarker} ${base}`;
    return base;
}

function btnCss() {
  return `
      background: rgba(255,255,255,0.08);
      color:#fff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 6px 10px;
      cursor:pointer;
    `;
}

function chipCss() {
  return `
      background: rgba(255,255,255,0.07);
      color:#fff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px;
      padding: 4px 10px;
      cursor:pointer;
      font: inherit;
    `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#096;");
}

async function copyToClipboard(value) {
    const text =
	  typeof value === "string"
	  ? value
	  : (() => {
              try {
		  return JSON.stringify(value, null, 2);
              } catch {
		  return String(value);
              }
          })();

    // Preferred modern API
    if (navigator?.clipboard?.writeText) {
	await navigator.clipboard.writeText(text);
	return true;
    }

    // Fallback (older browsers, restricted contexts)
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();

    try {
	document.execCommand("copy");
	return true;
    } finally {
	document.body.removeChild(ta);
    }
}

export { iconFor, btnCss, chipCss, escapeHtml, escapeAttr, copyToClipboard };
export default { iconFor, btnCss, chipCss, escapeHtml, escapeAttr ,copyToClipboard};


# --- end: helpers.js ---



# --- begin: manager.js ---

/*
 * Copyright (c) 2025 m7.org
 * License: MTL-10 (see LICENSE.md)
 */
function install(sys, ctx){
    console.log('installing lib');
    const pkgId = ctx?.pkg?.id;
    if(!pkgId){
	console.warn('no package id found for lib, cannot proceed with install!');
	return;
    }
    
    let lib = bootstrap.data.getPackageModule(pkgId,'lib').content;
    window.lib = lib;
    console.log(sys,ctx);
}

function destroy(sys,ctx){
    console.warn('destroying');
    window.lib = null;
}
export default {
    install , destroy
    
};


# --- end: manager.js ---



# --- begin: path.js ---

// path.js
// ---------------------------------------------
// UI-ish helper (inspect by absolute path)
// ---------------------------------------------
function showPath(ctx, path) {
  const s = String(path || "").trim();
  const info = ctx.inspector.inspect(s, {
    includeRef: true,
    includeChildren: true,
    show: false,
  });

  if (!info) {
    ctx.lib.detail.set(ctx, { error: `Not found: ${s}` });
    return false;
  }

  ctx.lib.detail.set(ctx, info);
  return true;
}

// ---------------------------------------------
// Path helpers (absolute paths)
// ---------------------------------------------
function _cleanPath(path) {
  return String(path || "").trim().replace(/^\.+|\.+$/g, "");
}

function parentPathOf(path) {
  const s = _cleanPath(path);
  if (!s) return null;

  const parts = s.split(".").filter(Boolean);
  if (parts.length <= 1) return null;

  return parts.slice(0, -1).join(".");
}

function leafNameOf(path) {
  const s = _cleanPath(path);
  if (!s) return "";

  const parts = s.split(".").filter(Boolean);
  return parts[parts.length - 1] || "";
}

// ---------------------------------------------
// Navigation (ctx-based; absolute paths)
// ---------------------------------------------
function canGoUp(ctx) {
  const curPath = String(ctx.currentRootPath || ctx.rootPath || "").trim();
  return !!parentPathOf(curPath);
}

function goUpOne(ctx) {
  const curPath = String(ctx.currentRootPath || ctx.rootPath || "").trim();
  const upPath = parentPathOf(curPath);
  if (!upPath) return false;

  const ok = ctx.lib.root.setRootFromInput(ctx, upPath);

  if (ok) {
    ctx.currentRootPath = upPath;
    ctx.rootPath = upPath; // keep both synced if you track both
  }

  return ok;
}

export { showPath, parentPathOf, leafNameOf, canGoUp, goUpOne };
export default { showPath, parentPathOf, leafNameOf, canGoUp, goUpOne };


# --- end: path.js ---



# --- begin: root.js ---

// root.js

function reparseCurrentRoot(ctx) {
  const { inspector, expanded, maxDepth } = ctx;

  inspector.parse({ maxDepth });

  expanded.clear();

  const rootPath = inspector?.tree?.path || inspector?._absRootPath || ctx.rootPath || ctx.currentRootPath;
  if (rootPath) expanded.add(rootPath);

  // rerender
  ctx.lib.tree.renderCollapsibleTree(ctx);
}

function setRootFromInput(ctx, input) {
  const { inspector, expanded, maxDepth, rootScope } = ctx;

  try {
    const next = new ctx.TreeInspector(input, { autoParse: false, global: rootScope });
    next.parse({ maxDepth });

    if (!next?.tree?.path) return false;

    // swap inspector internals (preserving instance)
    inspector.rootRef       = next.rootRef;
    inspector.tree          = next.tree;
    inspector.index         = next.index;
    inspector._absRootPath  = next._absRootPath;
    inspector._absRootParts = next._absRootParts;

    // sync ctx path trackers (you’re using both in other files)
    ctx.rootPath = inspector.tree.path;
    ctx.currentRootPath = inspector.tree.path;

    expanded.clear();
    expanded.add(inspector.tree.path);

    ctx.lib.tree.renderCollapsibleTree(ctx);
    return true;
  } catch {
    return false;
  }
}

export { reparseCurrentRoot, setRootFromInput };
export default { reparseCurrentRoot, setRootFromInput };


# --- end: root.js ---



# --- begin: toggle.js ---

// toggles minimize/restore on `~` / backtick
function enable(ctx, {
    hotkey = ["Backquote"],     // ` and ~ share the same physical key on US keyboards
    minimizeHeight = "44px",    // header-ish height
    ignoreWhenTyping = true,
} = {}) {
    const el =    ctx.el;
    if (!el) throw new Error("[tree.console] enableToggle: missing el");

    // don't double-bind
    if (el.__m7Toggle?.enabled) return;

    const header = el.querySelector('[data-head]') || el.firstElementChild; // prefer data-head if you add it
    const body   = el.querySelector('[data-body]') || el.querySelector('[data-tree]')?.parentElement; // your grid wrapper
    const input  = el.querySelector("[data-q]");

    const state = {
	enabled: true,
	minimized: false,
	prev: {
	    height: el.style.height,
	    minHeight: el.style.minHeight,
	},
	handler: null,
    };

    function setMinimized(on) {
	state.minimized = !!on;

	if (state.minimized) {
	    // keep element visible, hide main body
	    if (body) body.style.display = "none";
	    el.style.height = minimizeHeight;
	    el.style.minHeight = minimizeHeight;
	    el.style.overflow = "hidden";
	    el.setAttribute("data-minimized", "1");
	} else {
	    if (body) body.style.display = "";
	    el.style.height = state.prev.height || "";
	    el.style.minHeight = state.prev.minHeight || "";
	    el.style.overflow = "";
	    el.removeAttribute("data-minimized");
	    // optional: focus search when re-opened
	    if (input) input.focus?.();
	}
    }

    state.handler = (e) => {
	// only toggle on chosen key (Backquote)
	if (!hotkey.includes(e.code)) return;
	/*
	// don't toggle if user is typing in an input/textarea/contenteditable
	if (ignoreWhenTyping) {
	const t = e.target;
	const typing =
	t &&
	(t.tagName === "INPUT" ||
	t.tagName === "TEXTAREA" ||
	t.isContentEditable);
	if (typing) return;
	}
	*/
	// avoid weird combos
	if (e.ctrlKey || e.metaKey || e.altKey) return;

	e.preventDefault();
	setMinimized(!state.minimized);
    };

    ctx.eventScope.addEventListener("keydown", state.handler, true);

    // expose controls on the element for other code paths
    el.__m7Toggle = {
	enabled: true,
	minimize: () => setMinimized(true),
	restore: () => setMinimized(false),
	toggle: () => setMinimized(!state.minimized),
	get minimized() { return state.minimized; },
	_state: state,
    };
}



function disable(ctx) {
    const el = ctx.el;
    if (!el?.__m7Toggle?.enabled) return;

    const state = el.__m7Toggle._state;
    try {
	ctx.eventScope.removeEventListener("keydown", state.handler, true);
    } catch {}

    // restore if minimized
    if (el.__m7Toggle.minimized) {
	el.__m7Toggle.restore();
    }

    el.__m7Toggle.enabled = false;
    delete el.__m7Toggle;
}


export {disable, enable} ;
export default  {disable, enable} ;


# --- end: toggle.js ---



# --- begin: tree.js ---

const ICONS = {
    object: "📁",     // hash / plain object
    array: "🔗",      // array
    function: "ƒ",    // function
    class: "🏛️",      // class
    scalar: "❓",     // primitive / data
    circular: "♻️",   // circular reference
};

function logLine(log, text){
    if (!log.text)
	log.text = "";
    log.text = log.text + text + "\n" ;
}
function printTree(
    value,
    {
	name = "root",
	indent = "",
	seen = new WeakSet(),
	isLast = true,
	log = {}
    } = {}
) {
    const branch = indent ? (isLast ? "└─ " : "├─ ") : "";
    const nextIndent = indent + (isLast ? "   " : "│  ");
    // Detect type
    let type = typeof value;
    
    // Class detection
    const isClass =
	  type === "function" &&
	  /^class\s/.test(Function.prototype.toString.call(value));

    let icon = ICONS.scalar;

    if (value && type === "object") {
	if (seen.has(value)) {
	    logLine(log,`${indent}${branch}${ICONS.circular} ${name}`);
	    return;
	}
	seen.add(value);

	if (Array.isArray(value)) {
	    icon = ICONS.array;
	} else {
	    icon = ICONS.object;
	}
    } else if (type === "function") {
	icon = isClass ? ICONS.class : ICONS.function;
    }

    logLine(log,`${indent}${branch}${icon} ${name}`);

    // Recurse into objects / arrays
    if (value && type === "object") {
	const entries = Object.entries(value);
	entries.forEach(([key, val], index) => {
	    printTree(val, {
		name: key,
		indent: nextIndent,
		seen,
		isLast: index === entries.length - 1,
		log
	    });
	});
    }

    //console.log(output);
    return log.text
}


# --- end: tree.js ---



# --- begin: TreeInspector.js ---

/*
  create proper console later.
  await shell.bootstrap.load({resource:"https://static.m7.org/vendor/m7BootStrap/examples/console/package.json"},{
  load: ["#runners.mount", (sys, ctx) => console.log("Loaded:", ctx.results)],
  error: [(sys, ctx) => console.error("Failed:", ctx.failed)],
  package: { hooks: true }
  })

  [...tree.index.byPath.values()]
  window.lib.testClass = class test { x = 1;static y = 2; static static_method(){}; instance_method(){}}

*/
import treeConsole          from './console.js';
import applyMixins          from './applyMixins.js';
import ClassInspectorTraits from './ClassInspector.js';

class TreeInspector {

    // ----------------------------
    // Static config / enrichers
    // ----------------------------
    static ICONS = {
	object: "📁",
	hash: "📁",
	array: "🔗",
	function: "ƒ",
	class: "🏛️",
	scalar: "❓",
	circular: "♻️",
	ref: "♻️",
	null: "∅",
	undefined: "∅",
	string: "🔤",
	number: "🔢",
	boolean: "✓" //x = '✕'
    };

    static NODE_ENRICHERS = {
	function: v => ({ signature: TreeInspector.getFunctionSignature(v) }),
	class:    v => ({ signature: TreeInspector.getFunctionSignature(v) }),
    };

    // ----------------------------
    // ctor / state
    // ----------------------------
    constructor(obj, options = {}) {
	// prefer window in browsers, otherwise globalThis
	const defaultGlobal =
	      (typeof window !== "undefined" && window) ||
	      (typeof globalThis !== "undefined" ? globalThis : undefined);

	const {
	    global = defaultGlobal,
	    hint = "root",
	    autoParse = true,

	    // bounds for slow-path root inference (object -> absolute path)
	    inferDepth = 6,
	    inferMaxNodes = 50_000,

	    // parse depth cap
	    maxDepth = Infinity,
	    includeClasses = true,
	    includeNonEnumerable = false,
	    ...rest
	} = options;

	this.global = global;

	// canonical global label (used for absolute paths)
	this.globalName =
	    (typeof window !== "undefined" && global === window) ? "window" :
	    (typeof globalThis !== "undefined" && global === globalThis) ? "globalThis" :
	    "global";

	// root reference (string selector OR object/function/scalar)
	this.rootRef = obj;

	this.options = {
	    hint,
	    autoParse,
	    inferDepth,
	    inferMaxNodes,
	    maxDepth,
	    includeClasses,
	    // authoritative root for string resolution + inference
	    globalsRoot: this.global,

	    ...rest,
	};

	// internal buffers / state
	this._out = "";
	this.tree = null;

	// absolute-root tracking (filled during parse)
	this._absRootParts = null;
	this._absRootPath = null;

	// indexes
	this.index = {
	    byPath: new Map(),
	    byRef: new WeakMap(),
	};

	if (autoParse !== false) {
	    this.parse();
	}
    }

    // ----------------------------
    // Input resolution
    // ----------------------------
    _resolveInput(obj) {
	// 1) string selector: resolve directly (fast + absolute)
	if (typeof obj === "string") {
	    const sel = obj.trim();
	    if (!sel) throw new Error("[TreeInspector] Empty selector string");

	    const { ref, parts } = TreeInspector.resolveDotPath(sel, {
		root: this.global,
		rootLabel: this.globalName,
	    });

	    if (ref == null) throw new Error(`[TreeInspector] Selector not found: ${sel}`);

	    const absParts = parts.length ? parts : [this.globalName, this.options.hint];
	    const absPath  = absParts.join(".");
	    const hint     = absParts[absParts.length - 1] ?? this.options.hint;

	    return { ref, absParts, absPath, hint };
	}

	// 2) object/function/scalar: infer absolute path (bounded) when possible
	const ref = obj;
	if (ref == null) throw new Error("[TreeInspector] root ref is null/undefined");

	const tt = typeof ref;

	// scalar roots: allow, but absolute identity is global.hint (or just hint if no global)
	if (!(tt === "object" || tt === "function")) {
	    const absParts = this.global ? [this.globalName, this.options.hint] : [this.options.hint];
	    return { ref, absParts, absPath: absParts.join("."), hint: this.options.hint };
	}

	const foundParts =
	      TreeInspector.inferAbsoluteRootParts(ref, {
		  root: this.global,
		  rootLabel: this.globalName,
		  maxDepth: this.options.inferDepth,
		  maxNodes: this.options.inferMaxNodes,
	      }) || (this.global ? [this.globalName, this.options.hint] : [this.options.hint]);

	const absParts = foundParts.length ? foundParts : (this.global ? [this.globalName, this.options.hint] : [this.options.hint]);
	const absPath  = absParts.join(".");
	const hint     = absParts[absParts.length - 1] ?? this.options.hint;

	return { ref, absParts, absPath, hint };
    }

    /**
     * Resolve "lib.foo.bar" from global root.
     * Normalizes symbolic roots so "document.location" => "window.document.location" (when global is window)
     * Returns {ref, parts} where parts ALWAYS start with rootLabel.
     */
    static resolveDotPath(selector, { root = globalThis, rootLabel = "globalThis" } = {}) {
	const raw = String(selector || "").trim();
	if (!raw) return { ref: null, parts: [] };

	let parts = raw.split(".").filter(Boolean);
	if (!parts.length) return { ref: null, parts: [] };

	// If user already included "window." / "globalThis." etc, strip it for traversal but keep for parts output.
	const hasExplicitRoot = (parts[0] === rootLabel);
	const walkParts = hasExplicitRoot ? parts.slice(1) : parts;

	let obj = root;
	for (const p of walkParts) {
	    if (obj == null) return { ref: null, parts: hasExplicitRoot ? [rootLabel, ...walkParts] : [rootLabel, ...parts] };
	    try { obj = obj[p]; }
	    catch { return { ref: null, parts: hasExplicitRoot ? [rootLabel, ...walkParts] : [rootLabel, ...parts] }; }
	}

	// Always return absolute parts starting with rootLabel
	const absParts = [rootLabel, ...walkParts];
	return { ref: obj, parts: absParts };
    }

    /**
     * Best-effort: find an absolute global path to `target` by scanning from `root`.
     * Uses ref identity (===). Bounded for safety.
     * Returns array of path parts (starting with rootLabel) or null.
     */
    static inferAbsoluteRootParts(target, {
	root = globalThis,
	rootLabel = (typeof window !== "undefined" && root === window) ? "window" : "globalThis",
	maxDepth = 6,
	maxNodes = 50_000,
	includeNonEnumerable = false,
	includeSymbols = false,
	skipKeys = new Set([
	    "frames", "top", "parent", "opener",
	    "webkitStorageInfo", "chrome", "external",
	]),
    } = {}) {
	if (target == null) return null;
	const tt = typeof target;
	if (!(tt === "object" || tt === "function")) return null;

	if (target === root) return [rootLabel];

	const seen = new WeakSet();
	const q = [{ obj: root, parts: [rootLabel], depth: 0 }];
	let visited = 0;

	const tryRead = (o, k) => {
	    try {
		if (includeNonEnumerable) {
		    const d = Object.getOwnPropertyDescriptor(o, k);
		    // skip accessors to avoid triggering getters
		    if (d && typeof d.get === "function" && !("value" in d)) return { ok: false };
		}
		return { ok: true, value: o[k] };
	    } catch {
		return { ok: false };
	    }
	};

	while (q.length) {
	    const { obj, parts, depth } = q.shift();
	    visited++;
	    if (visited > maxNodes) return null;

	    if (obj == null) continue;
	    const t = typeof obj;
	    if (!(t === "object" || t === "function")) continue;

	    if (seen.has(obj)) continue;
	    seen.add(obj);

	    if (depth >= maxDepth) continue;

	    let keys = [];
	    try {
		keys = includeNonEnumerable ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
	    } catch {}

	    let symKeys = [];
	    if (includeSymbols) {
		try { symKeys = Object.getOwnPropertySymbols(obj); } catch {}
	    }

	    for (const k of keys) {
		if (skipKeys.has(k)) continue;

		const r = tryRead(obj, k);
		if (!r.ok) continue;

		const v = r.value;
		if (v === target) return [...parts, String(k)];

		const vt = typeof v;
		if (v && (vt === "object" || vt === "function")) {
		    q.push({ obj: v, parts: [...parts, String(k)], depth: depth + 1 });
		}
	    }

	    for (const s of symKeys) {
		const r = tryRead(obj, s);
		if (!r.ok) continue;

		const v = r.value;
		if (v === target) return [...parts, s.toString()];

		const vt = typeof v;
		if (v && (vt === "object" || vt === "function")) {
		    q.push({ obj: v, parts: [...parts, s.toString()], depth: depth + 1 });
		}
	    }
	}

	return null;
    }

    // ----------------------------
    // Core parse (authoritative paths)
    // ----------------------------
    parse({
	value = this.rootRef,
	maxDepth = this.options.maxDepth,
	includeClasses = this.options.includeClasses,
	includeNonEnumerable = this.options.includeNonEnumerable
    } = {}) {
	// flush
	this.tree = null;
	this.index.byPath.clear();
	this.index.byRef = new WeakMap();

	// resolve root input into {ref, absParts, absPath, hint}
	const resolved = this._resolveInput(value);

	// keep canonical absolute identity on the instance
	this.rootRef = resolved.ref;
	this._absRootParts = resolved.absParts;
	this._absRootPath = resolved.absPath;
	this.options.hint = resolved.hint;

	const rootParts = this._absRootParts.slice();
	const rootName  = rootParts[rootParts.length - 1] ?? this.options.hint;

	const seen = new WeakMap(); // obj -> canonical node (cycle/shared refs)
	//console.log('include classes = ',includeClasses);
	const rootNode = this._parseNode({
	    value: this.rootRef,
	    name: rootName,
	    pathParts: rootParts,
	    parentPath: null,
	    depth: 0,
	    seen,
	    maxDepth,
	    includeClasses,
	    includeNonEnumerable,
	});

	this.tree = rootNode;
	return this;
    }

    _parseNode({
	value,
	name,
	pathParts,
	parentPath,
	depth,
	seen,
	maxDepth,
	includeNonEnumerable = false,
	includeClasses = false,
    }) {
	const t = typeof value;

	const isClass =
	      t === "function" &&
	      (() => {
		  try { return /^class\s/.test(Function.prototype.toString.call(value)); }
		  catch { return false; }
	      })();

	const type =
	      value && t === "object"
	      ? (Array.isArray(value) ? "array" : "hash")
	      : isClass
	      ? "class"
	      : (t === "function" ? "function" : (value === null ? "null" : t));

	// IMPORTANT: classes become “branchy” when includeClasses is on
	const isBranch =
	      type === "hash" ||
	      type === "array" ||
	      (includeClasses && type === "class");
	//console.log('is branch', isBranch,includeClasses, type);
	const isRefable = (value && (t === "object" || t === "function")); // ok
	const path = pathParts.join(".");

	// cycles/shared refs (only meaningful for objects/functions)
	if (isRefable && seen.has(value)) {
	    const refNode = {
		type: "ref",
		name,
		ref: value,
		path,
		pathParts,
		parentPath,
		depth,
	    };
	    this._indexNode(refNode);

	    
	    return refNode;
	}

	const node = {
	    type,
	    name,
	    ref: value,
	    path,
	    pathParts,
	    parentPath,
	    depth,
	};

	Object.assign(node, TreeInspector.NODE_ENRICHERS[type]?.(value));

	// scalar preview
	if (!isBranch && type !== "ref" && type !== "function" && type !== "class") {
	    const { preview, kind } = TreeInspector.formatScalar(value);
	    node.valuePreview = preview;
	    node.valueKind = kind;
	}

	this._indexNode(node);

	// instance enrichment for objects
	if (type === "hash") {
	    this._enrichHashInstance(node, value);
	}

	
	// if not a branch, we’re done
	if (!isBranch) return node;

	// mark seen for cycle-safe descent
	if (isRefable) seen.set(value, node);

	// depth cap
	if (depth >= maxDepth) {
	    node.children = [];
	    return node;
	}

	node.children = [];

	if (type === "class") {
	    const entries = this._classChildren(node, {
		includeNonEnumerable,
		// any other knobs you want to pass through
	    });
	    console.log('got this', entries);
	    for (const entry of entries) {
		const k = entry.name;
		const v = entry.ref;

		// Special: ensure prototype branch includes non-enumerables (class methods are non-enumerable)
		const forceNonEnum =
		      entry && entry.name === "prototype" && entry.type === "hash";

		const childNode = this._parseNode({
		    value: v,
		    name: k,
		    pathParts: pathParts.concat([k]),
		    parentPath: path,
		    depth: depth + 1,
		    seen,
		    maxDepth,
		    includeNonEnumerable: forceNonEnum ? true : includeNonEnumerable,
		    includeClasses,
		});

		// Preserve/enrich metadata coming from ClassInspector
		if (entry && typeof entry === "object") {
		    // keep any flags like isStatic, ownerKind, synthetic...
		    for (const metaKey of Object.keys(entry)) {
			if (metaKey === "children") continue; // TreeInspector owns children
			if (metaKey === "ref") continue;      // TreeInspector owns ref
			if (metaKey === "path") continue;     // TreeInspector owns path
			if (metaKey === "pathParts") continue;
			if (metaKey === "parentPath") continue;
			if (metaKey === "depth") continue;
			if (metaKey === "name") continue;
			if (metaKey === "type") continue;     // TreeInspector may compute type
			childNode[metaKey] = entry[metaKey];
		    }
		}

		node.children.push(childNode);
	    }

	    return node;
	}
	if (0 &&type === "class") {
	    // expects ClassInspectorTraits mixed into TreeInspector prototype
	    // should return array of { name, value } pairs or node-like objects (your choice)
	    const entries = this._classChildren(node, {
		includeNonEnumerable,
		// any other knobs you want to pass through
	    });
	    //console.log('got this', entries);
	    for (const entry of entries) {
		//coerce into something digestible.
		const k = entry.name;
		const v = entry.ref;              
		node.children.push(
		    this._parseNode({
			value: v,
			name: k,
			pathParts: pathParts.concat([k]),
			parentPath: path,
			depth: depth + 1,
			seen,
			maxDepth,
			includeNonEnumerable : true,
			includeClasses,
		    })
		);
	    }
	    return node;

	    /*
	    // entries are already nodes
	    node.children = entries;

	    // IMPORTANT: index children manually
	    for (const child of entries) {
	    this._indexNode(child);
	    }

	    return node; */
	    /*
	      node.children.push(...entries);
	      console.log('in class diver, checking...',entries);
	      for (const { name: k, value: v } of entries) {
	      node.children.push(
	      this._parseNode({
	      value: v,
	      name: k,
	      pathParts: pathParts.concat([k]),
	      parentPath: path,
	      depth: depth + 1,
	      seen,
	      maxDepth,
	      includeNonEnumerable,
	      includeClasses,
	      })
	      );
	      }
	      console.log(node);
	      return node;*/
	}

	// existing hash/array behavior
	if (type === "hash") {
	    const keys = includeNonEnumerable
		  ? Reflect.ownKeys(value)
		  : Object.keys(value);

	    
	    for (const k of keys) {
		const v = value[k];
		node.children.push(
		    this._parseNode({
			value: v,
			name: String(k),
			pathParts: pathParts.concat([String(k)]),
			parentPath: path,
			depth: depth + 1,
			seen,
			maxDepth,
			includeNonEnumerable,
			includeClasses,
		    })
		);
	    }

	    this._appendInstanceProtoChildren(
		node,
		value,
		{
		    pathParts,
		    depth,
		    seen,
		    maxDepth,
		    includeNonEnumerable,
		    includeClasses,
		},
		{
		    includeSymbols: true,
		    skipBuiltins: true,
		}
	    );
	    
	} else {
	    for (let i = 0; i < value.length; i++) {
		const k = String(i);
		node.children.push(
		    this._parseNode({
			value: value[i],
			name: k,
			pathParts: pathParts.concat([k]),
			parentPath: path,
			depth: depth + 1,
			seen,
			maxDepth,
			includeNonEnumerable,
			includeClasses,
		    })
		);
	    }
	}

	return node;
    }

    
    
    _old__parseNode({
	value,
	name,
	pathParts,
	parentPath,
	depth,
	seen,
	maxDepth,
    }) {
	const t = typeof value;

	const isClass =
	      t === "function" &&
	      (() => {
		  try { return /^class\s/.test(Function.prototype.toString.call(value)); }
		  catch { return false; }
	      })();

	const type =
	      value && t === "object"
              ? (Array.isArray(value) ? "array" : "hash")
              : isClass
              ? "class"
              : (t === "function" ? "function" : (value === null ? "null" : t));

	const isBranch  = (type === "hash" || type === "array");
	const isRefable = (value && t === "object");
	const path      = pathParts.join(".");

	// cycles/shared refs
	if (isRefable && seen.has(value)) {
	    const refNode = {
		type: "ref",
		name,
		ref: value,
		path,
		pathParts,
		parentPath,
		depth,
	    };
	    this._indexNode(refNode);
	    return refNode;
	}

	const node = {
	    type,
	    name,
	    ref: value,
	    path,
	    pathParts,
	    parentPath,
	    depth,
	};

	Object.assign(node, TreeInspector.NODE_ENRICHERS[type]?.(value));

	// scalar preview (everything that's not a branch/ref/function/class)
	if (!isBranch && type !== "ref" && type !== "function" && type !== "class") {
	    const { preview, kind } = TreeInspector.formatScalar(value);
	    node.valuePreview = preview;
	    node.valueKind = kind;
	}

	this._indexNode(node);

	if (!isBranch) return node;

	// mark seen for cycle-safe descent
	if (isRefable) seen.set(value, node);

	// depth cap
	if (depth >= maxDepth) {
	    node.children = [];
	    return node;
	}

	node.children = [];

	if (type === "hash") {
	    for (const [k, v] of Object.entries(value)) {
		node.children.push(
		    this._parseNode({
			value: v,
			name: k,
			pathParts: pathParts.concat([k]),
			parentPath: path,
			depth: depth + 1,
			seen,
			maxDepth,
		    })
		);
	    }
	} else {
	    for (let i = 0; i < value.length; i++) {
		const k = String(i);
		node.children.push(
		    this._parseNode({
			value: value[i],
			name: k,
			pathParts: pathParts.concat([k]),
			parentPath: path,
			depth: depth + 1,
			seen,
			maxDepth,
		    })
		);
	    }
	}

	return node;
    }

    _indexNode(node) {
	if (node?.path) this.index.byPath.set(node.path, node);

	const r = node?.ref;
	const tr = typeof r;
	if (r && (tr === "object" || tr === "function")) {
	    if (!this.index.byRef.has(r)) this.index.byRef.set(r, node);
	}
    }

    // ----------------------------
    // INSPECT (authoritative)
    // ----------------------------
    inspect(target, opts = {}) {
	const {
	    reparseIfMissing = true,
	    includeChildren = false,
	    childrenPreview = 60,
	    includeRef = true,
	    show = false,
	} = opts;

	if (!this.tree) {
	    if (reparseIfMissing) this.parse();
	    if (!this.tree) return null;
	}

	let node = null;
	
	if (typeof target === "string") {
	    const normalized = this._normalizePath(target);
	    node = this.index.byPath.get(normalized) || null;
	} else {
	    node = this._findByRef(target);
	}

	if (!node) return null;

	//get canonical path for references. console can figure it out.
	const canonicalPath = this.getCanonicalPath(node);
	const payload = {
	    type: node.type,
	    name: node.name,
	    path: node.path,
	    canonicalPath,
	    pathParts: node.pathParts,
	    parentPath: node.parentPath ?? null,
	    depth: node.depth ?? null,
	    signature: node.signature ?? null,
	    valuePreview: node.valuePreview ?? null,
	    valueKind: node.valueKind ?? null,
	    isStatic : node.isStatic ?? false,
	    isInstance: node.isInstance ?? false,
	    childCount: Array.isArray(node.children) ? node.children.length : 0,
	    childrenPreview: Array.isArray(node.children)
		? node.children.slice(0, childrenPreview).map(c => ({ name: c.name, type: c.type, path: c.path }))
		: [],
	};

	if (includeChildren) payload.children = node.children || [];
	if (includeRef) payload.ref = node.ref;
	
	if (show) {
	    const icon = TreeInspector.ICONS[node.type] ?? TreeInspector.ICONS.scalar;
	    console.log(`${icon} ${node.path}`);
	    if (payload.signature) console.log(payload.signature);
	    if (payload.childCount) console.log(`children: ${payload.childCount}`);
	}

	return payload;
    }

    getCanonicalPath(node){
	if (!node) return null;
	
	if (node.type !== "ref" || node.ref == null)
	    return node.path;
	
	const canonical = this._findByRef(node.ref);
	return  (canonical && canonical.node !== node) ?
	    canonical.path:
	    node.path;
    }
    
    _normalizePath(p) {
	const s = String(p ?? "").trim().replace(/^\.+|\.+$/g, "");
	if (!s) return this.tree?.path ?? this._absRootPath ?? this.options.hint;

	// absolute path?
	if (this.index.byPath.has(s)) return s;

	// relative -> prefix current root path
	const rootPath = this.tree?.path ?? this._absRootPath ?? this.options.hint;
	if (s === rootPath) return rootPath;
	if (s.startsWith(rootPath + ".")) return s;

	return rootPath + "." + s;
    }

    _findByRef(ref) {
	if (ref == null) return null;
	const t = typeof ref;
	if (!(t === "object" || t === "function")) return null;
	return this.index.byRef.get(ref) || null;
    }

    // ----------------------------
    // FIND (authoritative)
    // ----------------------------
    find(partial, opts = {}) {
	const {
	    limit = 50,
	    types = null,
	    pathsOnly = false,
	    includeRef = false,
	    includeSignature = true,
	    match = "both", // "name" | "path" | "both"
	    reparseIfMissing = true,
	} = opts;

	if (!this.tree) {
	    if (reparseIfMissing) this.parse();
	    if (!this.tree) return [];
	}

	const typeSet = types ? new Set(types) : null;

	let predicate;
	if (typeof partial === "function") {
	    predicate = partial;
	} else if (partial instanceof RegExp) {
	    predicate = (node) => {
		const hay =
		      match === "path" ? node.path :
		      match === "name" ? node.name :
		      `${node.path} ${node.name}`;
		return partial.test(hay);
	    };
	} else {
	    const needle = String(partial ?? "").toLowerCase();
	    predicate = (node) => {
		const hay =
		      match === "path" ? node.path :
		      match === "name" ? node.name :
		      `${node.path} ${node.name}`;
		return String(hay).toLowerCase().includes(needle);
	    };
	}

	const results = [];
	for (const node of this.index.byPath.values()) {
	    if (results.length >= limit) break;
	    if (!node) continue;
	    if (typeSet && !typeSet.has(node.type)) continue;

	    let ok = false;
	    try { ok = !!predicate(node); } catch { ok = false; }
	    if (!ok) continue;

	    if (pathsOnly) {
		results.push(node.path);
	    } else {
		const hit = {
		    type: node.type,
		    name: node.name,
		    path: node.path,
		    parentPath: node.parentPath ?? null,
		    childCount: Array.isArray(node.children) ? node.children.length : 0,
		};
		if (includeRef) hit.ref = node.ref;
		if (includeSignature && node.signature) hit.signature = node.signature;
		results.push(hit);
	    }
	}

	return results;
    }

    // ----------------------------
    // DUMP (validation)
    // ----------------------------
    _out = "";
    _resetOut() { this._out = ""; }
    _logLine(text) { this._out += text + "\n"; }
    _flushOut() { const out = this._out; this._out = ""; return out; }

    dump({
	node = this.tree,
	icons = TreeInspector.ICONS,
	toConsole = true,
    } = {}) {
	this._resetOut();
	this._dumpNode(node, { indent: "", isLast: true, icons });
	const out = this._flushOut();
	if (toConsole) console.log("%s", out);
	return out;
    }

    _dumpNode(node, { indent, isLast, icons }) {
	if (!node) return;

	const branch = indent ? (isLast ? "└─ " : "├─ ") : "";
	const nextIndent = indent + (isLast ? "   " : "│  ");

	const icon =
	      icons[node.type] ??
	      (["string","number","boolean","undefined","symbol","bigint"].includes(node.type)
               ? icons.scalar
               : icons.scalar);

	const vp =
	      node.valuePreview != null && node.valuePreview !== ""
              ? ` = ${String(node.valuePreview)}`
              : "";

	this._logLine(`${indent}${branch}${icon} ${node.name}${vp}`);

	const kids = node.children || [];
	for (let i = 0; i < kids.length; i++) {
	    this._dumpNode(kids[i], {
		indent: nextIndent,
		isLast: i === kids.length - 1,
		icons,
	    });
	}
    }
    
    // ----------------------------
    // Helpers
    // ----------------------------
    static formatScalar(value, maxLen = 140) {
	const t = typeof value;

	if (value === null) return { preview: "null", kind: "null" };
	if (t === "undefined") return { preview: "undefined", kind: "undefined" };

	if (t === "string") {
	    const s = value.length > maxLen ? value.slice(0, maxLen) + "…" : value;
	    return { preview: JSON.stringify(s), kind: "string" };
	}

	if (t === "number" || t === "bigint") return { preview: String(value), kind: t };
	if (t === "boolean") return { preview: value ? "true" : "false", kind: "boolean" };
	if (t === "symbol") return { preview: value.toString(), kind: "symbol" };

	if (value instanceof Date) {
	    return { preview: `Date(${isNaN(value) ? "Invalid" : value.toISOString()})`, kind: "date" };
	}
	if (value instanceof RegExp) return { preview: value.toString(), kind: "regexp" };

	try {
	    const s = String(value);
	    return { preview: s.length > maxLen ? s.slice(0, maxLen) + "…" : s, kind: t };
	} catch {
	    return { preview: "[unprintable]", kind: "unknown" };
	}
    }

    static getFunctionSignature(fn) {
	const info = {
	    name: fn?.name || "",
	    arity: typeof fn === "function" ? fn.length : 0,
	    params: null,
	    isNative: false,
	    sourcePreview: null,
	};

	if (typeof fn !== "function") return info;

	let src = "";
	try { src = Function.prototype.toString.call(fn); }
	catch { return info; }

	info.isNative = /\{\s*\[native code\]\s*\}/.test(src);
	info.sourcePreview = src.length > 200 ? src.slice(0, 200) + "…" : src;
	if (info.isNative) return info;

	// ---- NEW: class definition => pull constructor(...) params ----
	// class X { constructor(a,b=1) {...} foo(x) {...} }
	if (/^\s*class\b/.test(src)) {
	    // NOTE: this is intentionally “simple”: it matches until the first ')'
	    // (so destructuring with nested parens may not be perfect, but good enough for most)
	    const cm = src.match(/\bconstructor\s*\(([^)]*)\)/);

	    // default constructor => no params
	    if (!cm) {
		info.params = [];
		return info;
	    }

	    const raw = (cm[1] ?? "").trim();
	    info.params = raw
		? raw.split(",").map(s => s.trim()).filter(Boolean)
		: [];
	    return info;
	}

	// ---- existing: function / arrow / method / accessor ----
	const m =
	      // function foo(a,b) {…}
	      src.match(/^[\s\(]*function\b[^(]*\(([^)]*)\)/) ||
	      // (a,b) => …
	      src.match(/^[\s\(]*\(([^)]*)\)\s*=>/) ||
	      // a => …
	      src.match(/^[\s\(]*([^=\s\(\),]+)\s*=>/) ||
	      // async foo(a,b) {…}
	      src.match(/^\s*async\s+[*]?\s*[^(\s]+\s*\(([^)]*)\)\s*\{/) ||
	      // *foo(a,b) {…} OR foo(a,b) {…}   (class methods stringify like this too)
	      src.match(/^\s*[*]?\s*[^(\s]+\s*\(([^)]*)\)\s*\{/) ||
	      // get foo() {…}
	      src.match(/^\s*get\s+[^(\s]+\s*\(([^)]*)\)\s*\{/) ||
	      // set foo(v) {…}
	      src.match(/^\s*set\s+[^(\s]+\s*\(([^)]*)\)\s*\{/);

	if (!m) return info;

	const raw = (m[1] ?? "").trim();
	info.params = raw
	    ? raw.split(",").map(s => s.trim()).filter(Boolean)
	    : [];
	return info;
    }
}




applyMixins(TreeInspector, ClassInspectorTraits);
function factory(...args){
    return new TreeInspector(...args);
}
const openConsole = treeConsole.console;
treeConsole.install(TreeInspector);
export { TreeInspector as cls, factory as inspector , openConsole};
export default { cls: TreeInspector, inspector: factory , console:openConsole};


# --- end: TreeInspector.js ---

