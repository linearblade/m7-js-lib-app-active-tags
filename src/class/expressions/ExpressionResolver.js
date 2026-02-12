/**
 * Expressions / Interpolation Class
 * --------------------------------
 *
 * This trait implements Active Tags’ **expression resolution and interpolation
 * system**. It is responsible for resolving symbolic target expressions
 * (e.g. `job:id`, `config:confirm.text`, `target:innerHTML`, `find:.title`)
 * into live runtime values using a provided execution context.
 *
 * Core responsibilities:
 * - Parse target expressions of the form `type:locator`
 * - Resolve those expressions against a runtime context (`ctx`)
 *   that may include:
 *     - job
 *     - ticket
 *     - buffer / buffer metadata
 *     - DOM elements (this / target / document queries)
 *     - configuration schema
 *     - transaction records
 * - Provide a single evaluation entry point (`eval(ctx, target)`)
 * - Support higher-level interpolation via a separate walker/compiler
 *
 * What this trait does NOT do:
 * - It does NOT execute jobs, stacks, or pipelines
 * - It does NOT schedule, queue, or control execution flow
 * - It does NOT mutate job or ticket state
 * - It does NOT manage data lifecycles or persistence
 * - It does NOT assume global state (all resolution is context-driven)
 *
 * Architectural role:
 * - Acts as the symbolic “glue” between declarative configuration and
 *   imperative runtime state
 * - Enables late binding: values are resolved at evaluation time, not
 *   at configuration or compile time
 * - Centralizes all dynamic lookup logic so no other subsystem performs
 *   ad-hoc expression parsing
 *
 * Resolution model:
 * - Target strings are first *parsed* into references or direct values
 * - Parsed targets are then *evaluated* to produce a final value
 * - Parsing and evaluation are intentionally separate concerns
 * - Unknown or unsupported targets resolve to `undefined` (no magic fallbacks)
 *
 * Extensibility:
 * - Target resolution is driven by a dispatcher that may evolve over time
 * - New target types (e.g. `inputs:`, `vars:`, `stage:`) can be added
 *   without changing the public API
 * - Custom resolution behavior may be injected via the evaluation context
 *
 * Security & discipline notes:
 * - DOM-based resolution (e.g. `find`, `closest`, `this`, `target`) is powerful
 *   and must only be used with trusted configuration
 * - This trait should remain deterministic, explicit, and boring
 *
 * This trait must remain:
 * - Context-driven (never global)
 * - Side-effect free
 * - Centrally authoritative for expression resolution
 */


/**
   this.expr = new ExpressionResolver({
   lib: this.lib,
   toJob: (x) => this.toJob(x),
   logger: this.logger,
   env: { window, document }
   });
*/
import CONSTANTS    from '../../constants.js';
import Interpolator from './Interpolator.js';
import buildDispatch from './dispatch.js';
export class ExpressionResolver {

    /**
     * Create a new ExpressionResolver instance.
     *
     * The resolver is responsible for parsing and evaluating symbolic target
     * expressions (e.g. `job:id`, `buffer_meta:headers.Authorization`,
     * `find:.title`) against a provided execution context.
     *
     * This constructor wires the resolver to:
     * - the Active Tags `lib` (required)
     * - an optional job normalization adapter (`toJob`)
     * - an optional logger
     * - an execution environment (`env`)
     *
     * Environment resolution:
     * - If `opts.env` is provided, it is treated as the authoritative environment
     *   for this resolver instance.
     * - Otherwise, the resolver falls back to the environment installed on `lib`
     *   (via `lib._env`, typically created by `lib/_env` boot).
     * - The resolved environment is used to derive canonical `window` and
     *   `document` references without directly probing globals.
     *
     * The resolver itself is:
     * - context-driven (no implicit global state)
     * - side-effect free
     * - safe to reuse across jobs and tickets
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *   The m7 lib instance. Required.
     *
     * @param {Function} [opts.toJob]
     *   Optional adapter used to normalize or coerce values into Job instances
     *   before resolution. If omitted, the resolver will use the provided value
     *   as-is.
     *
     * @param {Object} [opts.logger]
     *   Optional logger implementation used for warnings or diagnostics.
     *
     * @param {Object} [opts.env]
     *   Optional explicit environment injection.
     *   When provided, this environment takes precedence over `lib._env`.
     *   Typical shape:
     *     {
     *       root: <global root>,
     *       window: <window/global>,
     *       document: <document>
     *     }
     *
     * @throws {Error}
     *   If `opts.lib` is not provided.
     */
    constructor(opts = {}) {
	const lib = opts.lib;
	if (!lib) throw new Error("[ExpressionResolver] lib is required");

	this.lib = lib;

	// adapters / utilities
	this.toJob  = opts.toJob || null;
	this.logger = opts.logger || null;
	this.interp = Interpolator;

	// ---------------------------------------------------------------------
	// Environment (m7-lib native)
	//  - Prefer caller-provided opts.env (explicit injection)
	//  - Else prefer lib._env (installed by lib/_env boot)
	//  - Else fallback to lib.hash.get(lib,"_env") / lib.hash.get(lib,"_env.root")
	// ---------------------------------------------------------------------

	// 1) explicit env injection (may be empty object)
	const env = lib.hash.is(opts.env) ? opts.env : {};

	// 2) lib env (preferred fallback)
	const libEnv  = lib._env || lib.hash.get(lib, "_env") || null;
	const root    = env.root || (libEnv && libEnv.root) || lib.hash.get(lib, "_env.root") || null;

	// keep env for callers
	// if caller didn’t provide env, we still expose the derived lib env shape
	this.env = env.root || env.window || env.document
            ? env
            : (libEnv || { root });

	// canonical window/document references
	// window => root (globalThis/window/global)
	// document => root.document (browser only)
	this.window   = env.window   || root || null;
	this.document = env.document || (root && root.document ? root.document : null);
    }

    /**
     * Emit a non-fatal warning during expression parsing or evaluation.
     *
     * This method is intentionally conservative:
     * - It never throws
     * - It never assumes a logger is present
     * - It performs no formatting or interpolation
     *
     * Warnings are routed to the injected logger (if provided), allowing
     * higher-level systems to decide how diagnostics are surfaced
     * (console, telemetry, devtools, etc.).
     *
     * This method exists so the expression resolver can report:
     * - invalid selectors
     * - missing targets
     * - unsafe or unsupported expressions
     *
     * without disrupting execution flow.
     *
     * @param {string} msg
     *   Human-readable warning message.
     *
     * @param {Object} [ctx]
     *   Optional execution context associated with the warning.
     *   This is passed through verbatim to the logger for debugging
     *   or diagnostic correlation.
     */

    warn(msg, ctx) {
	// Soft warning channel: no throw, no assumptions
	if (this.logger && typeof this.logger.warn === "function") {
            this.logger.warn(msg, ctx);
	}
    }


    /**
     * Normalize a job-like value into a Job instance (if possible).
     *
     * This helper exists to decouple the expression resolver from any
     * specific Job implementation. If a `toJob` adapter was provided at
     * construction time, it will be used to coerce or normalize the input.
     *
     * If no adapter is provided, the input value is returned as-is.
     *
     * This allows the resolver to:
     * - accept real Job instances
     * - accept job-like objects during testing or debugging
     * - avoid hard dependencies on Job internals
     *
     * @param {*} job
     *   A Job instance, job-like object, or arbitrary value.
     *
     * @returns {*}
     *   The normalized Job instance if an adapter is available,
     *   otherwise the original value.
     */
    _asJob(job) {
	if (this.lib.utils.baseType(this.toJob, "function")) {
            return this.toJob(job);
	}
	return job;
    }

    /**
     * Parse a target expression into a resolvable reference.
     *
     * A target expression has the general form:
     *
     *   "type:locator"
     *
     * Examples:
     *   "job:id"
     *   "config:confirm.text"
     *   "this:innerHTML"
     *   "target:value"
     *   "window:location.href"
     *   "doc:#id"
     *   "find:.title"
     *
     * This method performs **parsing only**. It does not evaluate or resolve
     * the expression to a concrete value.
     *
     * Resolution strategy:
     * - The target string is split on the first `:`
     * - A dispatcher is built using the provided execution context (`ctx`)
     * - If a built-in dispatcher exists for `type`, it is invoked
     * - Otherwise, the context itself may provide an override handler
     * - Unknown target types resolve to `undefined` (no implicit fallbacks)
     *
     * The returned value is one of:
     * - a target reference object `{ src, prop }`
     * - a DOM element
     * - a direct value
     * - `undefined` if the target cannot be resolved
     *
     * The execution context (`ctx`) is free-form and may contain any data
     * required by target resolvers. Commonly used slots include:
     *   - job
     *   - ticket
     *   - buffer
     *   - env
     *   - trigger
     *
     * @param {Object} ctx
     *   Free-form execution context used to build the target dispatcher.
     *
     * @param {string} target
     *   Target expression string to parse.
     *
     * @returns {*}
     *   A parsed target reference, direct value, DOM element, or `undefined`.
     */
    parse(ctx, target) {
	const lib = this.lib;

	ctx = lib.hash.to(ctx) || {};
	if (!target) return undefined;

	// split only on first colon
	target = lib.utils.toString(target, 1);
	const pos = target.indexOf(":");
	const typeRaw = (pos < 0) ? target : target.slice(0, pos);
	const loc = (pos < 0) ? undefined : target.slice(pos + 1);

	if (!typeRaw) return undefined;

	const type = String(typeRaw).toLowerCase().trim();

	const disp = buildDispatch(this, ctx, loc);

	// 1) Prefer built-in dispatch if it exists
	// Note: dispatcher closures already capture ctx + loc
	if (Object.prototype.hasOwnProperty.call(disp, type)) {
            return disp[type]();
	}

	// 2) Otherwise allow ctx override (greater ctx)
	// ctx[type] may be a function (or function reference) or a value
	if (lib.hash.is(ctx) && type in ctx) {
            const custom = ctx[type];
            const fn = lib.func.get(custom);
            if (fn) return fn(loc);
            return { src: custom, prop: loc };
	}

	// 3) Unknown target type => undefined (no magic)
	return undefined;
    }
    
    /**
     * Evaluate a target expression and return its resolved value.
     *
     * This method is a convenience wrapper that combines:
     * - `parse(ctx, target)` to interpret a symbolic target expression, and
     * - `evalParse(parse)` to extract the concrete value from the parsed result.
     *
     * It is intended for one-off or immediate resolution of target expressions.
     * For advanced use cases (e.g. deferred evaluation or inspection of parsed
     * targets), callers may invoke `parse()` and `evalParse()` separately.
     *
     * Evaluation behavior:
     * - If the target resolves to a `{ src, prop }` reference, the property is
     *   retrieved using `lib.hash.get()` or `lib.dom.get()`.
     * - If the target resolves directly to a value or DOM element, it is returned
     *   as-is.
     * - Unknown or unsupported targets resolve to `undefined`.
     *
     * @param {Object} ctx
     *   Free-form execution context used for resolution.
     *   Common fields include:
     *     - job
     *     - ticket
     *     - buffer
     *     - env
     *
     * @param {string} target
     *   Target expression string to evaluate (e.g. `"job:id"`, `"config:name"`,
     *   `"find:.title"`).
     *
     * @returns {*}
     *   The resolved value of the target expression, or `undefined` if the target
     *   cannot be resolved.
     */
    eval(ctx, target) {
	const parse = this.parse(ctx, target);
	return this.evalParse(parse);
    }
    

    /**
     * Evaluate a parsed target result into a concrete runtime value.
     *
     * `evalParse` takes the output of `parse(ctx, target)` and resolves it to
     * its final value.
     *
     * Evaluation rules:
     * - If the input is a target reference object of the form `{ src, prop }`:
     *     - If `src` is a DOM element, the value is resolved via
     *       `lib.dom.get(src, prop)`
     *     - Otherwise, the value is resolved via `lib.hash.get(src, prop)`
     * - If the input is a DOM element, it is returned as-is
     * - If the input is a scalar value, it is returned unchanged
     * - If the input is `undefined` or `null`, `undefined` is returned
     *
     * This method performs no parsing and no validation. It assumes the parsed
     * input is well-formed and deterministic.
     *
     * @param {*} parse
     *   Parsed target returned from `parse(ctx, target)`. This may be:
     *     - a target reference object `{ src, prop }`
     *     - a DOM element
     *     - a scalar value
     *     - `undefined`
     *
     * @returns {*}
     *   The resolved runtime value, or the original input if no evaluation
     *   is required.
     */
    evalParse(parse) {
	const lib = this.lib;

	if (parse == null) return undefined;
	if (!lib.utils.baseType(parse, "object")) return parse;
	if (lib.dom.is(parse)) return parse;

	const src  = lib.hash.get(parse, "src");
	const prop = lib.hash.get(parse, "prop");

	// Not a TargetRef → return as-is
	if (src === undefined || src === null) return parse;

	// No property specified → return source
	if (prop == null || prop === "") return src;

	return lib.dom.is(src)
            ? lib.dom.get(src, prop)
            : lib.hash.get(src, prop);
    }

    /**
     * Parse a compact v098-style op list into normalized op records.
     *
     * Supported input items:
     * - Object: passed through unchanged (assumed already normalized)
     * - String:
     *    - "op"           -> { op:"op", args:[], raw:"op" }
     *    - "op:a,b,c"     -> { op:"op", args:["a","b","c"], raw:"op:a,b,c" }
     *
     * Notes:
     * - This is a compatibility parser intended for v1 bridging.
     * - Malformed items are ignored unless an `err` handler is provided.
     * - This function does NOT evaluate expressions; it only tokenizes.
     *
     * @param {*} input
     *   Array-like, string, or mixed list of entries.
     *
     * @param {Function} [err]
     *   Optional error callback invoked as err(reason, { item, index }).
     *
     * @returns {Array<Object>}
     *   Normalized list of op records / objects.
     */
    parseList(input, err) {
	const lib = this.lib;

	// copy + normalize to array
	const src = lib.array.to(lib.utils.deepCopy(input), CONSTANTS.ARR_TO_OPTS);
	const out = [];

	const onErr = lib.func.get(err);

	for (let i = 0; i < src.length; i++) {
            const item = src[i];

            // pass-through object (already normalized)
            if (lib.hash.is(item)) {
		out.push(item);
		continue;
            }

            // string shorthand: "op" or "op:a,b,c"
            if (lib.str.is(item)) {
		const raw = item;

		const idx = raw.indexOf(":");
		if (idx === -1) {
                    out.push({ op: raw, args: [], raw });
                    continue;
		}

		const op = raw.substr(0, idx);
		const rem = raw.substr(idx + 1);

		const args = lib.array.to(rem, { split: /,/, trim: true });
		out.push({ op, args, raw });
		continue;
            }

            // unknown item type
            if (onErr) onErr("invalid_item", { item, index: i });
	}

	return out;
    }

    
    /**
     * Materialize interpolations within an arbitrary value using the provided context.
     *
     * This is a convenience wrapper that:
     *  1) parses `${...}` tokens within strings (deep scan), and
     *  2) evaluates them against `ctx` using this resolver’s target evaluation (`eval`).
     *
     * Encapsulated expressions like `"${job:id}"` materialize to the raw underlying value.
     * Template expressions like `"id=${job:id}"` materialize to strings.
     *
     * @param {Object} ctx
     *   Free-form execution context used for evaluation (job, ticket, env, etc).
     *
     * @param {*} value
     *   Any value (object/array/string/scalar) that may contain `${...}` tokens.
     *
     * @returns {*}
     *   A structurally equivalent value with all `${...}` expressions materialized.
     */
    materialize(ctx, value) {
	const parsed = this.interp.parseExpressions(value);

	return this.interp.evalCompiled(parsed, (expr) => {
            // `expr` is the inner string from `${...}` without the braces
            return this.eval(ctx, expr);
	});
    }
}

export default ExpressionResolver;
