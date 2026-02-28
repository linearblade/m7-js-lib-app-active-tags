/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * ---------------------------------------------------------------------------
 * INERT ARCHIVAL FILE - NOT USED BY ACTIVE TAGS RUNTIME
 * ---------------------------------------------------------------------------
 * [AT_INERT_ARCHIVE]
 * @internal
 * @deprecated
 *
 * This file is retained for historical/reference purposes only.
 * It is not imported by the current runtime path and is not part of v1 execution.
 *
 * Maintenance policy:
 * - DO NOT import this file from runtime code.
 * - Do not treat this file as source of truth for current behavior.
 * - Do not use this file for user/public documentation generation.
 * - Prefer `JobConfig.js` and related active schema modules instead.
 * ---------------------------------------------------------------------------
 */

/* ------------------------------------------------------------
     * Private section methods 
     * ------------------------------------------------------------ */
    /**
     * Derive and freeze creation-time runtime artifacts.
     *
     * This method produces *creation-only* artifacts derived from the
     * already-compiled Job configuration. These artifacts are intended
     * for runtime consumption and must not be mutated after creation.
     *
     * Current behavior (v1.0):
     * - Acts as a coordination point for artifact derivation.
     * - Invokes optional derivation hooks if present.
     * - Freezes the resulting artifact object to prevent mutation.
     *
     * Design intent:
     * - Artifacts are built once per configuration lifecycle.
     * - Rebuilding is explicit and opt-in via `opts.rebuild`.
     * - Sub-derivation methods are intentionally stubbed and will be
     *   implemented incrementally as the runtime matures.
     *
     * Policy:
     * - If artifacts already exist and `opts.rebuild !== true`,
     *   this method is a no-op.
     *
     * Inputs:
     * - Prefers `this.schema` (normalized, groomed configuration).
     * - Falls back to an empty object if schema is not yet available.
     *
     * Side effects:
     * - Writes `this.artifacts` as a frozen object:
     *     {
     *       stackDefs,
     *       intervalDefs,
     *       pipelineDefs
     *     }
     * - Sets `this.artifactsBuilt = true`.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.rebuild]
     *     Force rebuilding artifacts even if already built.
     *
     * @returns {void}
     */
    _deriveArtifacts(opts = {}) {
	const lib = this.lib;
	const rebuild = !!opts.rebuild;

	// If already built and not rebuilding, do nothing.
	if (!rebuild && this.artifactsBuilt) return;

	// Prefer schema (groomed), fall back to conf (raw merged)
	const src = lib.hash.is(this.schema) ? this.schema : {};

	// ---- Derive stack defs
	let stackDefs;
	if (typeof opts.deriveStacks === "function") {
            stackDefs = opts.deriveStacks(this, src, opts);
	} else if (typeof this._deriveStackDefs === "function") {
            stackDefs = this._deriveStackDefs(src, opts);
	} else {
            stackDefs = {};
	}

	// ---- Derive interval defs
	let intervalDefs;
	if (typeof opts.deriveIntervals === "function") {
            intervalDefs = opts.deriveIntervals(this, src, opts);
	} else if (typeof this._deriveIntervalDefs === "function") {
            intervalDefs = this._deriveIntervalDefs(src, opts);
	} else {
            intervalDefs = {};
	}

	// ---- Derive pipeline defs
	let pipelineDefs;
	if (typeof opts.derivePipelines === "function") {
            pipelineDefs = opts.derivePipelines(this, src, opts);
	} else if (typeof this._derivePipelineDefs === "function") {
            pipelineDefs = this._derivePipelineDefs(src, opts);
	} else {
            pipelineDefs = {};
	}

	// Snapshot + freeze (creation-only)
	const artifacts = {
            stackDefs: stackDefs || {},
            intervalDefs: intervalDefs || {},
            pipelineDefs: pipelineDefs || {}
	};

	// deepCopy ensures caller hooks can't retain references; freeze prevents later mutation
	this.artifacts = freezeDeep(lib.hash.deepCopy(artifacts));
	this.artifactsBuilt = true;
    }

    /* ------------------------------------------------------------
     * Private derivation hooks (intentionally strict stubs for now)
     * ------------------------------------------------------------ */

    _deriveStackDefs(conf, opts = {}) {
	// TODO: derive stack definitions from conf (job-type archetypes, stacks, triggers, etc.)
	return {};
    }

    _deriveIntervalDefs(conf, opts = {}) {
	// TODO: derive interval definitions from conf (interval policies, named intervals, etc.)
	return {};
    }

    _derivePipelineDefs(conf, opts = {}) {
	// TODO: derive pipeline definitions from conf (pre/post chains, transforms, etc.)
	return {};
    }
