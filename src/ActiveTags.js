/*
  This file is part of M7.ORG/ACTIVE TAGS.

M7.ORG/ACTIVE TAGS is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

M7.ORG/ACTIVE TAGS is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with M7.ORG/ACTIVE TAGS. If not, see <https://www.gnu.org/licenses/>.
  
  v-1.0
  [ ] pass legacyremap or default function
  [ ] pass logger
  [ ] self definable stacks for non blocking process
  [ ] improve stack functionality
  [ ] chain requests from base object
  [ ] eject or stop processing on  setup errors
  [ ] setup configurable default settings on stack jobs
  
  
  V-0.9.9
  ---final---
  [/] this code base is a cluster fuck. clean it before switch over to 1.0
      --this is far improved. a litte more cleaning and check.
  [x] attempt to cut over to cleaner loop based flow processing for requests
  [/] intervals need to stop on error. figure out way to know when interval is running.
      --intervals also run the risk of clogging under slow network. figure out the correct way to streamline
      --(may already be doing it. need to double check)
  [x] pushStack() probably needs cleanup work
  [x] submitForm at very least needs to chain a second action. ideally make it configurable.
  [ ] trailing (leading as well?) space in data-response (chains) = has error
  [ ] no action in the form causes a form misconfiguration instead of no url defined.
  [ ] reset on form submit needs to be re tested.

  ---fix ups -- defaults no longer working.
  [x] fix default src for response  //$FIXUP -- seems already done?
  [x] urlencoded default settings.  //$FIXUP -- seems already done?

  V-0.9.7
  ---update--- :: both were working. broke in 9.8++ rework
  [x] allow form trigger events
      -allows submitForm only
  [x] process form trigger , then the form itself
  
  V-0.9.6
  ---update---
  [x] external config
  [x] intervals -- working, then re-borked in 0.9.8 - re enable.
  [x] extract hard coded input names from individual functions
  
  V-0.9.5
  ---important. ---
  [x] start logging flowControl
  [x] runqueue needs to be fully implemented on both sides. (errror / load)
  (test throw error in all circumstances ... tested request, on-submit, pre/post)
  [x] function hints (pointers for functions to find arguments)
  [/] finalize naming convention for inputs -- sort of fixed with dataset import and remap
  
  ---less important. still really useful. ---
  [x] integrate submit and load into same library.
  [x] decide how to reset or allow multuple runs
  [ ] setup stages of execution, so to prevent run runs without intending to
  [ ] add attribute data-max-tries --? what was this for?

  
  ---bonus todo---
  [x] reset function
  [ ] improve log() function
  [ ] improve log searching
  [x] investigate lib.func.get and see if you can pass a function name for anons (flow control);
  [x] disable logging or request attaching with debug
  

 */

import applyMixins from './applyMixins.js';
import requireLibs from './requireLibs.js';
import trait_load  from './traits/load.js';
import trait_diag  from './traits/diagnostics.js';
import trait_exp   from './traits/expressions.js';
import Scheduler   from './Scheduler.js';

class ActiveTags {
    static DEFAULT_SELECTOR = '[class*=script-]';

    constructor(conf = {}) {
	const lib = conf.lib || (typeof window !== 'undefined' ? window.lib : null);
	this.lib = lib;

	requireLibs(lib, "data.ws.WorkSpace hash site.delagator str.interp", { mod: "[activeTags]" });

	if (!lib.site.delegator && lib.site.delagator) {
	    lib.site.delegator = lib.site.delagator;
	}

	this._log = [];
	this.intervals = {};
	this.jobCounter = 0;

	// legacy map (optional)
	this.jobs = {};

	this.ws = new lib.data.ws.WorkSpace();
	this.scheduler = new Scheduler({ prefix: "at" });

	const confObj = lib.hash.to(conf);
	delete confObj.lib;

	this.conf = lib.hash.merge(
	    { debug: false, log: { enable: false } },
	    confObj
	);

	this.bootSweep();
	this.startObserver();
    }

    //remember to make selector configurable
    startObserver(){
	this.domObserver = new DomChangeObserver({
	    root: document.body,
	    selectors: [ActiveTags.DEFAULT_SELECTOR],
	    debounceMs: 25,
	    observeAttributes: false,
	    // use this to avoid the bindage. => lexically captures
	    onChange: (batch) => this._onDomChanges(batch),
	});

	this.domObserver.start();
    }

    _onDomChanges(batch) {
	// batch.added is [{ el, selectors }]
	// you decide: bootSweep/registerJobs/detach/etc.
    }
    stopObserver(){
	if(this.domObserver)
	    this.domObserver.stop();
    }

    //defined in traits/load. sweeps dom for jobs and installs them
    //if new job is found, trigger a start
    bootSweep(){}

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
    //triggers when new dom found
    observer(){
	// still undefined
	this.bootSweep(change);
    }
}

applyMixins(ActiveTags, trait_load, trait_diag, trait_exp);
export { ActiveTags };
export default ActiveTags;
