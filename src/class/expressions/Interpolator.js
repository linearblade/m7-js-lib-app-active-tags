/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */


/**
 * Deep-parses an arbitrary value and precompiles interpolatable expressions.
 *
 * This function walks any JavaScript value (object, array, or scalar) and
 * detects strings containing `${...}` expression tokens. It does NOT resolve
 * expressions; it only classifies and prepares them for later evaluation.
 *
 * The scan is deep and structural:
 * - Objects are traversed by key
 * - Arrays are traversed by index
 * - Non-string scalars are returned unchanged
 *
 * Expression rules:
 * 1) Encapsulated expression
 *    A string that consists of exactly ONE expression token and nothing else:
 *
 *      "${foo}"
 *
 *    This is treated as a *value expression*.
 *    At runtime, evaluation MUST return the raw resolved value
 *    (number, object, DOM node, etc.), NOT a string.
 *
 * 2) Template expression
 *    A string that contains one or more expression tokens mixed with
 *    surrounding text:
 *
 *      "${foo} - ${bar}"
 *      "hello ${name}"
 *
 *    This is treated as a *template expression*.
 *    At runtime, evaluation MUST return a string produced by interpolation.
 *
 * 3) Non-expression string
 *    Strings with no `${...}` tokens are returned unchanged.
 *
 * Output contract:
 * - The returned structure mirrors the input structure exactly.
 * - Parsed expressions may be replaced with a compiled descriptor object
 *   suitable for fast runtime evaluation.
 * - No resolution, evaluation, or side effects occur during parsing.
 *
 * Purpose:
 * - Allow expressions to be parsed once at job/config creation time
 * - Avoid repeated token scanning during execution
 * - Preserve correct value vs string semantics at runtime
 *
 * @param {*} input
 *   Any JavaScript value: object, array, string, number, boolean, null, etc.
 *
 * @returns {*}
 *   A deep-cloned or structurally equivalent value with interpolatable
 *   expressions precompiled. Non-expression values are returned as-is.
 */


const EXPR_RE = /\$\{([^}]+)\}/g;
const FULL_EXPR_RE = /^\$\{([^}]+)\}$/;


/**
 * Deep-parse interpolatable expressions inside an arbitrary value.
 *
 * @param {*} input
 * @returns {*}
 */
export function parseExpressions(input) {
    // fast exits
    if (input == null) return input;

    const t = typeof input;

    if (t === "string") {
        return parseStringExpr(input);
    }

    if (Array.isArray(input)) {
        let out = new Array(input.length);
        for (let i = 0; i < input.length; i++) {
	    out[i] = parseExpressions(input[i]);
        }
        return out;
    }

    if (t === "object") {
        let out = {};
        for (const k in input) {
	    if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
	    out[k] = parseExpressions(input[k]);
        }
        return out;
    }

    // number, boolean, function, symbol, etc
    return input;
}

/**
 * Parse a single string and detect expression semantics.
 *
 * @param {string} str
 * @returns {string|object}
 */
function parseStringExpr(str) {
    // quick reject
    if (str.indexOf("${") === -1) {
        return str;
    }

    // case 1: fully encapsulated value expression
    const full = FULL_EXPR_RE.exec(str);
    if (full) {
        return {
	    __expr: true,
	    kind: "value",
	    raw: str,
	    parts: [
                { expr: full[1].trim() }
	    ]
        };
    }

    // case 2: template expression
    let parts = [];
    let lastIndex = 0;
    let match;

    EXPR_RE.lastIndex = 0;

    while ((match = EXPR_RE.exec(str))) {
        const idx = match.index;

        if (idx > lastIndex) {
	    parts.push(str.slice(lastIndex, idx));
        }

        parts.push({ expr: match[1].trim() });
        lastIndex = EXPR_RE.lastIndex;
    }

    if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex));
    }

    return {
        __expr: true,
        kind: "template",
        raw: str,
        parts
    };
}


export function evalCompiled(node, resolveExpr) {
  if (node == null) return node;

  // expression descriptor
  if (node && typeof node === "object" && node.__expr === true) {
    if (node.kind === "value") {
      // raw value return (not string)
      return resolveExpr(node.parts[0].expr);
    }
    // template => string
    return node.parts.map(p => (
      typeof p === "string" ? p : String(resolveExpr(p.expr))
    )).join("");
  }

  if (Array.isArray(node)) return node.map(x => evalCompiled(x, resolveExpr));

  if (typeof node === "object") {
    const out = {};
    for (const k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      out[k] = evalCompiled(node[k], resolveExpr);
    }
    return out;
  }

  return node;
}
/*
// inside VM step, before calling the op
const resolvedArgs = evalCompiled(v.args, (expr) => {
  // this is where ExpressionResolver does the real work
  return at.expr.eval(expr, { job, ticket, inputs, ctx, trigger });
});

// then call builtin
res = await builtin({
  job,
  args: resolvedArgs,
  ticket,
  inputs,
  ctx,
  trigger,
  step: v.stepRec,
});
*/
export const WALKER = {parseExpressions, evalCompiled} ;

export default WALKER;
