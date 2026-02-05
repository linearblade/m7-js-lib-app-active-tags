
import applyMixins from './helpers/applyMixins.js';
//import requireLibs from './helpers/requireLibs.js';
import trait_job  from './traits/job.js';
import trait_load  from './traits/load.js';
import trait_sweep  from './traits/sweep.js';
import trait_muta  from './traits/mutationObserver.js';
//import trait_diag  from './traits/diagnostics.js';
import trait_exp   from './traits/expressions.js';
import trait_cst   from './traits/constructor.js';
import trait_evt    from './traits/events.js';
import trait_int    from './traits/intervals.js';
import JobRegistry   from './class/job/Registry.js';
import CONSTANTS   from './constants.js';
import ExpressionResolver from './class/ExpressionResolver.js';
import Engine from './class/engine/Engine.js';
import testHooks from './class/engine/testHooks.js';
import IntervalController from './class/interval/Controller.js';
import EventController    from './class/event/Controller.js';
import builtins           from './builtins/index.js';
class ActiveTags {
    constructor(lib, conf = {}) {
	if (!lib) {
            throw new Error('[activeTags] constructor requires lib as first argument');
	}

	// allow helpers to assume this.lib exists
	this.lib = lib;
	
	// minimal require so we can normalize config
	lib.require.all(CONSTANTS.LIB_HASH, { mod: '[activeTags]' });

	// canonical config coercion
	conf = lib.hash.to(conf);

	lib.require.all(CONSTANTS.CORE_DEPS ,                    { mod: '[activeTags]' } );
	const svc = lib.require.service(CONSTANTS.CORE_SERVICES, { mod: '[activeTags]', returnMap: true } );
	// external managers (injected, non-owning)
	this.svc = {};
	// now you can tie them to semantic slots safely
	this.svc.delegator       = svc[CONSTANTS.SERVICE_DELEGATOR] || null;
	this.svc.interval        = svc[CONSTANTS.SERVICE_INTERVAL] || null;
	this.svc.log             = svc[CONSTANTS.SERVICE_LOG] || null;
	this.svc.domObserver     = svc[CONSTANTS.SERVICE_OBSERVER] || null;
	/*
	this.svc.interval.opts.onEvent = (ev) => {
	    console.log("[IM]", ev.type, ev.name, ev.reason || "", ev.message || "");
	};*/
	this.expr = new ExpressionResolver({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    logger: this.logger,
	    env: { window, document }
	});

	
	// runtime state
	this.jobCounter = 0;
	this.jobsLegacy = {};

	// workspace + scheduler
	this.ws = new lib.primitive.workspace.WorkSpace();
	this.jobs = new JobRegistry({ lib , prefix: 'at' });

	// options (delegated)
	this.opts = this.getOpts(conf);
	this.conf = this.opts;
	//this.engine = new Engine({lib,jobRegistry: this.jobs});
	//console.log('jamming test hooks', testHooks);
	this.engine = new Engine({
	    lib,
	    jobRegistry: this.jobs,
	    hooks:conf.testHooks?testHooks:{},
	    builtins : builtins
	});

	this.intervals = new IntervalController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	});

	const first = lib.array.to(CONSTANTS.DEFAULT_SELECTOR)[0];
	this.events = new EventController ({
	    lib:this.lib,
	    toJob: (x) => this.toJob(x),
	    AT: this,
	    selector: first
	});

	
	const doc = lib.hash.get(lib, '_env.root.document');
	if (doc && doc.body) {
	    this.load();
	    this.startObserver();
	    this.intervals.registerAll();
	    this.events.registerAll();
	    //on by default, falsy to prevent.
	    if(!lib.bool.no(conf.intervalOn))
		this.intervals.on();
	    if(!lib.bool.no(conf.eventOn))
		this.events.on();
	}
	
    }

    
    
    //cycles the jobs. if one is found with a status ready to start runs it. otherwise skips
    //at this point, the job can be set to inflight and ignored. controller will be set to job on startup, and it cna notify it on completion
    start(){ /*still undefined*/   }
    
    //employed by interval manager to periodically pickup new jobs automatically. may alternately utilize a dom observer to notice changes.
    sniffer(){
	/*
	//still undefined
	this.bootSweep() // runs on interval.
	*/
    }
}

applyMixins(ActiveTags, trait_job, trait_load, trait_sweep,  trait_muta, trait_exp,trait_cst,trait_evt,trait_int);
export { ActiveTags };
export default ActiveTags;
