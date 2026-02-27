/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * ActiveTags
 * ==========
 *
 * PROJECT OVERVIEW
 * ----------------
 * ActiveTags is a declarative, backend-driven runtime for hydrating
 * reusable DOM components.
 *
 * It allows HTML elements to declare behavior through configuration,
 * which is compiled into Jobs and executed through a deterministic Engine.
 *
 * The system separates:
 *
 *   Configuration compilation
 *   DOM discovery and attachment
 *   Job registration
 *   Execution orchestration
 *   Runtime subsystems such as events, intervals, and observation
 *
 * ActiveTags is not a template engine.
 * It is not a virtual DOM framework.
 * It is not a reactive state system.
 *
 * It is a structured execution engine for DOM-bound Jobs.
 *
 *
 * ARCHITECTURAL ROLE
 * ------------------
 * The ActiveTags class is the top-level orchestrator and public API surface.
 *
 * It is responsible for:
 *   Compiling configuration via Schema
 *   Wiring core runtime services
 *   Instantiating subsystem controllers
 *   Exposing public lifecycle methods
 *
 * It delegates execution to:
 *   Engine
 *
 * It delegates DOM discovery to:
 *   DiscoverController
 *
 * It delegates runtime triggers to:
 *   EventController
 *   IntervalController
 *   ObserverController
 *
 *
 * SUBSYSTEM COMPOSITION
 * ---------------------
 * After construction, the instance exposes:
 *
 *   this.ctx
 *   this.engine
 *   this.jobs
 *   this.events
 *   this.intervals
 *   this.observer
 *   this.discover
 *   this.runtime
 *
 * Each subsystem is independently responsible for its own runtime behavior.
 *
 *
 * CONFIGURATION MODEL
 * -------------------
 * Configuration is compiled transactionally by atSchema.
 * The compiled configuration snapshot is stored on:
 *
 *   this.conf
 *
 * Runtime subsystems must treat this configuration as authoritative.
 *
 *
 * CONTEXT MODEL
 * -------------
 * ActiveTags exposes a global runtime context bag at:
 *
 *   this.ctx
 *
 * This is intended for application-level shared runtime context.
 * It is distinct from per-run `ctx` values passed to `engine.tick()`/`engine.drain()`.
 *
 *
 * LIFECYCLE
 * ---------
 * Construction performs:
 *   Configuration compilation
 *   Service resolution
 *   Subsystem instantiation
 *
 * Calling start() performs:
 *   Initial DOM scan
 *   Optional observer activation
 *   Event and interval registration
 *   Optional runtime enablement
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * ActiveTags must remain:
 *   A thin orchestrator
 *   Execution-agnostic outside of Engine
 *   Deterministic in configuration
 *   Clear in subsystem boundaries
 *
 *
 * PUBLIC API SURFACE
 * ------------------
 * Core lifecycle:
 *   start()
 *
 * Convenience helpers:
 *   enqueueAll(opts)
 *
 * Job interaction helpers:
 *   Provided via trait_job
 *
 *
 * EXTENSIBILITY
 * -------------
 * New runtime subsystems should be implemented as controllers
 * and injected during construction.
 *
 * Public API additions should remain minimal and explicit.
 */

import applyMixins from './helpers/applyMixins.js';
//import requireLibs from './helpers/requireLibs.js';

import trait_job          from './traits/job.js';
import trait_eng          from './traits/engine.js';

import JobRegistry        from './class/job/Registry.js';
import CONSTANTS          from './constants.js';
import ExpressionResolver from './class/expressions/ExpressionResolver.js';
import Engine             from './class/engine/Engine.js';

import IntervalController from './class/interval/Controller.js';
import ObserverController from './class/observer/Controller.js';
import EventController    from './class/event/Controller.js';
import DiscoverController from './class/discover/Controller.js';
import RuntimeController  from './class/runtime/Controller.js';

import atSchema           from './at_config/Schema.js';
import DEFAULT_CONFIG     from './at_config/DEFAULT_CONFIG.js';
class ActiveTags {
    /**
     * Construct an ActiveTags runtime instance.
     *
     * Contract:
     * - Compiles top-level runtime config from defaults + user overrides.
     * - Resolves required m7 dependencies/services.
     * - Instantiates runtime subsystems (registry, engine, controllers).
     * - Initializes global ActiveTags runtime context at `this.ctx`.
     * - Passes this ActiveTags instance to Engine as `AT`.
     * - Does not start scanning/listening/executing until `start()` is called.
     *
     * @param {Object} lib
     * Required m7 lib instance.
     *
     * @param {Object} [conf={}]
     * Optional user configuration merged over `DEFAULT_CONFIG`.
     *
     * @throws {Error}
     * If `lib` is missing or required services/dependencies cannot be resolved.
     */
    constructor(lib, conf = {}) {
	if (!lib) {
            throw new Error('[activeTags] constructor requires lib as first argument');
	}
	this.schema = new atSchema({lib, def_conf:DEFAULT_CONFIG, user_conf: conf});
	this.opts = this.conf   = this.schema.snapShot();
	//console.log(this.conf);

	// allow helpers to assume this.lib exists
	this.lib = lib;
	
	// minimal require so we can normalize config
	lib.require.all(CONSTANTS.LIB_HASH, { mod: '[activeTags]' });


	lib.require.all(CONSTANTS.CORE_DEPS ,                    { mod: '[activeTags]' } );
	const svc = lib.require.service(CONSTANTS.CORE_SERVICES, { mod: '[activeTags]', returnMap: true } );
	// external managers (injected, non-owning)
	this.svc = {};
	// now you can tie them to semantic slots safely
	this.svc.delegator       = svc[CONSTANTS.SERVICE_DELEGATOR] || null;
	this.svc.interval        = svc[CONSTANTS.SERVICE_INTERVAL] || null;
	this.svc.log             = svc[CONSTANTS.SERVICE_LOG] || null;
	this.svc.domObserver     = svc[CONSTANTS.SERVICE_OBSERVER] || null;


	if (this.svc.log && this.conf.log.enabled) {
	    for (const key in this.conf.log.buckets) {
		//console.log(` creating ${key} `,this.conf.log.policy);
		this.svc.log.createBucket(this.conf.log.buckets[key], this.conf.log.policy);
	    }
	}
	/*
	  this.svc.interval.opts.onEvent = (ev) => {
	  console.log("[IM]", ev.type, ev.name, ev.reason || "", ev.message || "");
	  };*/
	

	
	this.expr = new ExpressionResolver({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    logger: null,// this.svc.log,
	    env: this.conf.env
	});

	
	// runtime state
	this.jobCounter = 0;

	// workspace + scheduler
	//this.ws = new lib.primitive.workspace.WorkSpace();
	this.ctx = {};

	this.jobs = new JobRegistry({ lib , conf: this.conf.job, env:this.conf.env});

	// options (delegated)
	//this.engine = new Engine({lib,jobRegistry: this.jobs});

	this.engine = new Engine({
	    AT           : this,
	    lib,
	    jobRegistry  : this.jobs,
	    conf         : this.conf.engine,
	    expr         : this.expr
	});

	this.intervals = new IntervalController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	});

	//const first = lib.array.to(CONSTANTS.DEFAULT_SELECTOR)[0];
	this.events = new EventController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	    selector: this.conf.boot.selector
	});

	this.observer = new ObserverController({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	});
	
	this.discover = new DiscoverController({
	    AT: this,
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	});

	this.runtime = new RuntimeController({
	    AT: this,
	    lib: this.lib,
	});
	
    }


    /**
     * Initialize the ActiveTags runtime.
     *
     * CONTRACT
     * --------
     * start() performs initial DOM discovery and activates runtime subsystems
     * according to boot configuration.
     *
     * It does not execute pipelines directly.
     * It does not enqueue autorun jobs.
     * It does not mutate job configuration.
     *
     * This method is intended to be called once during application boot.
     *
     *
     * PRECONDITIONS
     * -------------
     * A valid document must exist at lib._env.root.document.
     * The document must expose a body element.
     *
     * Throws if the runtime environment does not provide a usable document.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Validates that a usable document exists.
     * 2. Performs an initial DOM scan via DiscoverController.scan().
     * 3. If boot.observeDom is enabled, starts the ObserverController.
     * 4. Registers interval and event definitions for all Jobs.
     * 5. Enables intervals and events if boot flags allow.
     *
     *
     * CONFIGURATION GATES
     * -------------------
     * The following boot flags control runtime activation:
     *
     *   boot.observeDom
     *   boot.intervals
     *   boot.events
     *
     * Each flag defaults to enabled unless explicitly disabled.
     *
     *
     * SIDE EFFECTS
     * ------------
     * May register new Jobs during DOM discovery.
     * May activate DOM observation.
     * May attach interval handlers.
     * May attach event handlers.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not automatically enqueue autorun pipelines.
     * Does not drain the Engine.
     * Does not reconcile previously removed DOM elements.
     *
     *
     * DESIGN NOTES
     * ------------
     * start() acts as the runtime activation boundary.
     * Configuration compilation must already be complete.
     * Subsystem instantiation must already be complete.
     */
    async start() {
	const lib = this.lib;

	const doc = lib.hash.get(lib, '_env.root.document');
	if (!doc || !doc.body)
            throw new Error("cannot start, active tags missing doc or doc body");

	// discovery (controller-owned)
	await this.discover.scan();

	if (!lib.bool.no(this.conf.boot.observeDom))
            this.observer.start();

	this.intervals.registerAll();
	this.events.registerAll();

	// on by default; falsy disables
	if (!lib.bool.no(this.conf.boot.intervals)) {
            const conditionalCount = await this.intervals.conditionalOn();
            //if (conditionalCount > 0) await this.engine.drain();
	}

	if (!lib.bool.no(this.conf.boot.events))
            await this.events.conditionalOn();
	//just fire the thing right away. we need to drain the autoruns anyhow
	await this.engine.drain();
    }
}


/**
 * Mixin Composition
 * -----------------
 *
 * applyMixins() extends the ActiveTags prototype with selected
 * trait modules.
 *
 * PURPOSE
 * -------
 * Traits are used here strictly as organizational helpers.
 * They allow large public method groups to be defined in
 * separate files without inflating the main class definition.
 *
 *
 * ARCHITECTURAL INTENT
 * --------------------
 * Traits used at this level must represent:
 *
 *   Public API helpers
 *   Stateless convenience methods
 *   Logic that does not require independent lifecycle management
 *
 * Traits must not:
 *
 *   Act as runtime subsystems
 *   Maintain internal state
 *   Register listeners
 *   Bind external services
 *
 * Subsystems with lifecycle responsibilities must be implemented
 * as controllers and instantiated explicitly in the constructor.
 *
 *
 * CURRENT TRAITS
 * --------------
 * trait_job
 *   Job-related helper methods that do not require config dependencies.
 *
 * trait_eng
 *   Public runtime convenience helpers such as enqueueAll().
 *
 *
 * DESIGN CONSTRAINT
 * -----------------
 * Traits are reserved for API surface organization only.
 * If a trait grows into a stateful or lifecycle-driven unit,
 * it must be refactored into a controller.
 */
applyMixins(
    ActiveTags,
    trait_job,   // no config deps
    trait_eng
);
export { ActiveTags };
export default ActiveTags;
