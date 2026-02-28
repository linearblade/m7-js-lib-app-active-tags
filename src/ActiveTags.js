/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * ActiveTags runtime orchestrator.
 *
 * Compiles configuration, resolves required dependencies/services, and wires
 * runtime controllers around the Engine.
 *
 * @see docs/contracts/ACTIVE_TAGS_CLASS.contract.md
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
import VERSION            from './version.js';
class ActiveTags {
    /**
     * Create an ActiveTags instance without activating runtime triggers.
     *
     * @param {Object} lib Initialized m7 lib instance.
     * @param {Object} [conf={}] User runtime configuration overrides.
     * @throws {Error} When required lib/dependency/service contracts are missing.
     * @see docs/contracts/ACTIVE_TAGS_CLASS.contract.md
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
	this.VERSION = ActiveTags.VERSION;
	
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
     * Activate runtime controllers using current boot configuration.
     *
     * Runs discovery, optional observer start, event/interval registration,
     * conditional event/interval activation, then drains the engine queue.
     *
     * @throws {Error} When runtime document/body is unavailable.
     * @see docs/contracts/ACTIVE_TAGS_CLASS.contract.md
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
 * Attach stateless trait helpers to the public ActiveTags API surface.
 *
 * @see docs/contracts/ACTIVE_TAGS_CLASS.contract.md
 */
applyMixins(
    ActiveTags,
    trait_job,   // no config deps
    trait_eng
);
ActiveTags.VERSION = VERSION;
export { ActiveTags };
export default ActiveTags;
