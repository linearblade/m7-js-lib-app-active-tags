export const intervalTrait = {


    startInterval(name,section,dopts){
	//setInterval(function () {element.innerHTML += "Hello"}, 1000);

	let job = this.toJob(name);
	
	if(!job){
	    this.error('startInterval: no job found for '+name);
	    return;
	}
	name = job.name;

	
	if(lib.hash.get(this.intervals,[name,"id"])){
	    this.error('startInterval already started for '+name);
	    return;
	}

	if (!section) section = lib.hash.get(job.ds,"interval");

	if (!section){
	    this.error('startInterval, not defined for job '+name);
	    return;
	}



	let repeat = section.repeat
	let maxRuns = parseInt(section.max) || 0;

	
	if (!repeat){
	    this.error('startIinterval -repeat not defined for '+name);
	    return;
	}


	let iRec  = {id:undefined, repeat:repeat,lock:0,count:0,max:(isNaN(maxRuns)?0:maxRuns)};
	lib.hash.set(this.intervals,name,iRec);



	let func = (obj,job, section) => {
	    return function (){
		let iSec = obj.intervals[job.name];
		let stackName = 'interval';
		if (!iSec || iSec.lock )return;
		iSec.lock =1;
		let count = (isNaN(parseInt(iSec.count))?0:parseInt(iSec.count)) +1;
		
		let max = iSec.max || 0;
		if (max >0 && count >max){
		    this.warn(`maximum iterations of interval reached (${max})`);
		    obj.stopInterval(job.name);
		    return ;
		}
		//console.log(`interval ${count} / ${max} for ${job.name}`);

		obj.pushStackStandard(stackName,job,section);
		obj.pushStack(stackName,job,'intervalUnlock',section);
		iSec.count = count;
		obj.runJob(job.name,stackName);
	    }

	};
	// needs to be a wrapper, containing the job name/seection or job as a whole.

	iRec.id = setInterval(func(this,job,section), repeat);

	
	
	/*
	  let func = lib.func.preWrap(this.wrap(this.processInterval),
	  {obj:this,item:this.runQueue.name[name],isInterval:name, prefix:'data-interval-' }
	  ) ;
	*/

	return 1;
	
    },

    stopInterval(name,dsection,dopts){
	let job = this.toJob(name);
	
	if(!job){
	    this.error('stopInterval: no job found for '+name);
	    return;
	}
	name = job.name;

	let id = lib.hash.get(this.intervals,[name,"id"]);
	if(lib.utils.isEmpty(id)){
	    this.error('stopInterval: no interval found for '+name);
	    return;
	}


	clearInterval(id);
	lib.hash.set(this.intervals,[name,"id"], undefined);
    },

    //$function intervalUnlock
    intervalUnlock(job,target, opts){
	opts = lib.hash.is(opts)?opts:lib.args.parse(lib.array.to(opts),{ignore:0},"ignore");
	if (lib.utils.isScalar(job))job = this.jobs[job];
	
	let interval = lib.hash.get(this.intervals[job.name]);
	if(!interval){
	    this.error('intervalUnlock: no interal found for '+job.name);
	    return parseInt(opts.ignore)==1?1:0;
	}
	lib.hash.set(interval, 'lock',0);
	return 1;
    },

    //$function intervalLock
    intervalLock(job,target,opts){
	//opts=lib.hash.to(opts,'ignore');
	opts = lib.hash.is(opts)?opts:lib.args.parse(lib.array.to(opts),{ignore:0},"ignore");
	if (lib.utils.isScalar(job))job = this.jobs[job];
	
	let interval = lib.hash.get(this.intervals[job.name]);
	if(!interval){
	    this.error('intervalLock: not found for '+job.name);
	    return parseInt(opts.ignore)==1?1:0;
	}
	lib.hash.set(interval, 'lock',1);
	return 1;
    },
    //$function intervalFlush
    intervalFlush(job,target,opts){
	opts = lib.hash.is(opts)?opts:lib.args.parse(lib.array.to(opts),{ignore:0},"ignore");
	if (lib.utils.isScalar(job))job = this.jobs[job];
	
	let interval = lib.hash.get(this.intervals[job.name]);
	if(!interval){
	    this.nonFatal('intervalFlush: no interval found for '+job.name);
	    return parseInt(opts.ignore)==1?1:0;
	}
	lib.hash.set(job,"stack.interval", []);
	return 1;
    }
};

export default intervalTrait;
