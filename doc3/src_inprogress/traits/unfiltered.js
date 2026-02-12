export const unfilteredTraits = {

    runChain(job,target,ws){
	let section = lib.hash.is(target)?target:lib.hash.get(job.ds,target);
	if(!section){
	    this.error(`runChain: job ${job.name} /${target}... mising or misconfigured configuration  ${target} in job ${job.name}`);
	    return 0;
	}
	this.log('runChain', job.name, `running chain for ${job.name} on ${target}`,section);

	let errHandle = lib.hash.get(section,'error_handling') || "block";
	let src = lib.hash.get(section,'src');
	if(!src){
	    //console.log('no buffer src specified');
	}else {
	    let rv = this.setBuffer(job,src);

	    if (!rv && errHandle !='block'){
		job.status='error';
		return 0;
	    }
	}

	
	let load =  this._parseFunctions(job,section.load) ;
	let error =this._parseFunctions(job,section.error ,0)  ;
	this.log('runChain', job.name, '>>RUN CHAIN',load,error,section);
	let rv = this._runFunctions(job,load,error,ws);
	if(!rv){
	    if(errHandle=='block')return 0;
	}
	
	let dst = lib.hash.get(section,'dst');
	if(!dst){
	    //console.log('no buffer dst specified');
	}

	if( section.dst){
            let rv = this.getBuffer(job,dst);
	    if (!rv &&errHandle !='block'){
		job.status='error';
		return 0;
	    }
        }


	
	return 1;
    },
    runFunctions(job,load,error,ws){
	if(!(job = this.toJob(job)) ){this.error('no job found');return 0;}
	load =  this._parseFunctions(job,load) ;
	error =this._parseFunctions(job,error ,0)  ;
	//console.log(load,error);
	let rv = this._runFunctions(job,load,error,ws);
	return rv;
    },

    /*
      when running functions you can specify varaibles in the string
      somefunc:a,b -- literals a and b
      somefunc:${a}, ${b} will interVars in the global namespace
      somefuc:$[local parseTarget]
     */
    //$fixup --clean / rename
    //$function _runFunctions
    _runFunctions(job,list,error,wsOverride){
	if(!(job = this.toJob(job)) ){this.error('no job found');return 0;}

	let runErr;
	wsOverride = lib.hash.to(wsOverride);
	this.log('flowControl',job.name, `running user functions for stage= ${job.stage}`,list,error);
	let scheme = this.interpScheme(job,undefined);
	let regex = new RegExp(/\$\[(.*?)\]/,"g");
	let builtIn = {
	    'interval_unlock': 'intervalUnlock',
	    'interval_lock': 'intervalLock',
	    'interval_flush': 'intervalFlush',
	    'call' : 'call'
	}
	let ws = Object.assign({obj:this,item:job,e:job.e},wsOverride);
	let obj = this;

	let evalArgs = function (job,scheme,args){
	     args = lib.array.to(args);
	    for (let i =0;i<args.length;i++){
		let raw = args[i];
		let match = undefined;
		args[i] = lib.str.interp(args[i], scheme);
		//this.parseTarget(job,dst);
		//console.log('checking ',args[i]);
		//console.log(`checking ${i} / ${job.name}/${rec.f} : ${raw} `,job);
		regex.lastIndex=0;
		if(match = regex.exec(raw)){
		    //args[i] = obj.parseTarget(job,match[1]);
		    //let p = obj.parseTarget(job,match[1]);
		    //console.log('parse target ',args , p);
		    //console.log('TRYING PARSE TARGET ON ', match[1]);
		    args[i] = obj.evalTarget(job,match[1]);
		    //console.log('GOT', args[i]);
		    //console.log(`match FOUND for ${raw} - ${args[i]} - ${match[1]}`);
		}else {
		    //console.log('match fail for '+raw);
		}
		//console.log(`>>ARGS ${raw} - ${args[i]} `,args[i],job);
	    }

	    return args;
	}
	for (let rec of list){

	    let found = false;
	    let args = evalArgs(job,scheme,rec.a);
	    let rv;
	    if(rec.f in builtIn){
		found = true;
		this.log('flowControl', job.name, `>>RUNNING BUILTIN ${rec.f}`);
		if(rec.f=='call'){
		    console.warn('trying experimental call');
		    let name = args.shift();
		    let func = lib.func.get(name);
		    if(!func){console.warn('no function found with name',name); rv=0; found=false;}
		    rv = func(...args);
		    rv = 1;
		}else
		rv = this[builtIn[rec.f]](job,target, args);
	    }else{
		found = lib.func.get(rec.f);
		rv = lib.func.get(rec.f,1)(ws,job.r,args);
	    }
	    //console.log(`RV = **${rv}**`);
	    if(!rv){
		let msg = found?
		    `did not return a true value. Fail over to error (if exists)`:
		    `${rec.f} not defined`;
		this.log('flowControl',job.name, msg);
		this.nonFatal(`flowControl: \nname:${job.name}\nfunction: ${rec.f}\n  stage: ${job.stage}\nmsg: ${msg}\n`);
		runErr=1;
		break;
	    }
	}
	if (!runErr)return 1;
	this.log('flowControl-error',job.name, `failing over to error flow (${error.length}) item`,error);
	let i =0;
	for (let rec of error){
	    let args = evalArgs(job,scheme,rec.a);
	    //console.log(`running error ${lib.utils.isScalar(job)?job:'function'}`,job);
	    //let rv = lib.func.get(rec.f,1)(...rec.a);
	    let rv = lib.func.get(rec.f,1)(ws,job.r,args);
	    if(!rv){
		this.error(`flowControl-error ${job.name} ....did not return a true value! Breaking execution @ position(${i}) f: ${rec.f}`);
		return 0;
	    }
	    i++;
	}
	return 0;
	
    },


    //catches HTTP response from send request, feeds back into runJob
    catchResponse(jobID,stackName, r){
	//console.log('caught a response',arguments);

	let job = this.toJob(jobID);
	if(!job){
	    this.error(`catchResponse, job (${jobID}) not found. cannot continue.`);
	    return;
	}
	job.r = r;
	//console.log(`caught response for ${job.name}`);
	this.runJob(jobID,stackName,1);

    },
    //$fixup -rename?
    setBuffer(job,src){
	let info  = this.parseTarget(job,src);
	//console.log('buffer-in', job.name, `writing ${src} to buffer`,info,job);
        if(!info) {
            console.error(`buffer-in ${job.name}, no buffer src provided`);
            return 0;
        }

	if (lib.dom.isDom(info.src)){
            job.buffer = lib.dom.get(info.src,info.prop);
	}else {
            this.log('buffer-in', job.name, 'getting with  lib.hash.get', lib.hash.get(info.src,info.prop));
            job.buffer = lib.hash.get(info.src, info.prop);
        }
	this.log('buffer-in', job.name, `sent ${src} to buffer`,info,job.buffer);
        return 1;


    },
    
    //$fixup -rename?
    getBuffer(job,dst){
	let info  = this.parseTarget(job,dst);
        if(!info) {
            this.log('write', job.name, 'no write target provided');
	    return 0;
        }
	
	if (lib.dom.isDom(info.src)){
	    lib.dom.set(info.src, info.prop,job.buffer);
        }else {
	    lib.hash.set(info.src,info.prop,job.buffer);
        }
        this.log('write', job.name, `wrote buffer to ${dst} `,info,job);
        return 1;
    },

    markComplete(job){
	if(!lib.hash.is(job))job = this.jobs[job];
	if (!job) return 0;
	return job.load= 1;
    },
    toJob(job){
	if(!lib.hash.is(job))job = this.jobs[job];
	return job?job:undefined;
    },
    
    runAll(stackName ='main'){

	for(let name in this.jobs){
	    let job = this.jobs[name];
	    if (job.load==1)continue;
	    if(lib.bool.isFalse(lib.hash.get(job.ds, "enable.autorun"))){
		this.warn(`job ${job.name} enable-auotrun set to false, skipping`);
		continue;
	    }
	    if( !this.meetsRequirements(job))continue;

	    this.log('runAll',null, `RUNALL: ${name}`);
	    if(job.status=='ready')
		this.runJob(job,'main');
	    else{
		this.warn(`job ${name} isnt ready. status = ${job.status}`);
	    }
	}
	return 1;
    },

    setRunning (job,stackName, state,rv=0){
	if(!(job = this.toJob(job))) return this.error('setRunning: no job found');
	lib.hash.set(job.ws,["stackRun",stackName],state);
	return rv;
    },
    getRunning (job,stackName){
	if(!(job = this.toJob(job))) return this.error('getRunning: no job found');
	return lib.hash.get(job.ws,["stackRun",stackName]);
    },
    
    
    //$function runJob
    runJob(job,stackName,opts){
	if(!(job = this.toJob(job))) return this.error('runJob: no job found');
	opts = lib.hash.to(opts,"force");
	if (lib.utils.toString(job.status,1).match('error')){
	    this.error(`job ${job.name} has status ${job.status} at stage ${job.stage}. cannot continue`);
	    return 0;
	}
	if(this.getRunning(job,stackName)==1 && opts.force !=1){
	    this.error(`job ${job.name} is already running`);
	    return 0;
	}
	this.setRunning(job,stackName,1);
	let disp = {
	    chain: 'runChain',
	    responseHead: 'catchResponse',
	    request: 'sendRequest',
	    attr: 'attrTransform',
	    intervalUnlock: 'intervalUnlock',
	    intervalStart: 'startInterval',
	    intervalStop: 'stopInterval',
	    complete: 'markComplete',
	    runAll : 'runAll'
	};

	
	let item = undefined;
	//while (item =job.stack.shift()){

	let stack = lib.hash.get(job,['stack',stackName]) || [];
	for (let item; item  =stack.shift();){
	    let [stage, func, target,opts] = lib.hash.expand(item, "s f t opts");
	    //console.log('running', item);
	    //console.log(`stage: ${stage}`);
	    if (lib.utils.isEmpty(func) || !(func in disp)){
		this.nonFatal(`not a valid stage (${stage} - ${func}) or is empty in ${job.name}` , job);
		job.status='error';
		return this.setRunning(job,stackname,0,0);
	    }
	    job.stage = stage;

	    
	    this.log('runJob', job.name, `running this.${disp[func]} for ${job.name}`);

	    let result = func=='runAll'?this.runAll('main'):this[disp[func]](job,target,opts);
	    
 

	    if(result ==1){
		//success
		job.status='ready';
		continue;
	    }else{
		if (result ==0) { //error
		    job.status='error';
		    return this.setRunning(job,stackName,0,0);
		}else { //wait for rerun
		    job.status='wait';
		    //console.log('responded with wait, run again to continue');
		    return this.setRunning(job,stackName,1,1);
		}
	    }
	}

	//console.log('JOB COMPLETE');
	//job.status='ready';
	return this.setRunning(job,stackName,0,1);

    
    },



    

    
    
    sendRequest(job,target,opts){
	opts = lib.hash.to(opts);
	if (!lib.hash.is(job) && !job.name){
	    this.error(`sendRequest: job  "${job.name}" is not a hash or missing a name`);
	    return 0;
	}
	this.log('sendRequest', job.name, 'in send request', job.ds,target);
	let section = lib.hash.is(target)?target:lib.hash.get(job.ds,target);
	if(!section){
	    this.error(`sendRequest: job "${job.name} /${target}...error in or missing configuration`);
	    return 0;
	}


 
        let url =section.action || job.attr.action || undefined;
        //url = lib.str.interp(url, this.interpScheme({obj:this,item:job},undefined) );
	let urlEncoded  = lib.utils.isEmpty(section.urlencoded)?1:section.urlencoded ;
	let method = section.method || job.attr.method || "get";

        let scheme = this.interpScheme(job,undefined);
	
	//console.log('SEND REQUEST', section);

	if(!url) {
	    this.error(`sendRequest: job "${job.name} ... no url defined`);
	    return 0;
	}

        url= lib.str.interp(url, scheme);

	//$$fixup
	//let body = opts.form?lib.dom.form.arrayToQS(opts.form.parms):lib.str.interp(section.body,scheme);
	let body = opts.body?lib.str.interp(opts.body,scheme):
	    opts.form?lib.dom.form.arrayToQS(opts.form.parms):
	    lib.str.interp(section.body,scheme);
	
	this.log("sendRequest", job.name,`sending request for ${section.url}`,body);

	lib._http.request(url,
			  {
			      body: body, method:method||"get", load:lib.func.preWrap(this.wrap(this.catchResponse),job.name,opts.stackName),
			      error:section.error,urlencoded:urlEncoded,
			      json:section.json,
			      credentials:true
			  });	    
	return "wait";
	
    },

    
    attrTransform(job,target){
	let prefix="";
	let section = lib.hash.get(job.ds,target);
	if(!section){
	    this.error(`attrTransform: job "${job.name}" / ${target} .error in or missing configuration, cannot attrTransform request for ${job.name} (${target})`);
	    return 0;
	}

	let filtered = section;
	if (Object.keys(filtered).length)this.log('attr-tranform',job.name, "running attr transform", filtered);
	job.e2 = job.e;
	for (let k in  filtered){
	    let scheme = this.interpScheme(job);
	    let fixed = lib.str.interp(filtered[k], scheme);
	    this.log('attr-transform', job.name, `${k} = > ${fixed}`,job);
	    lib.dom.set(job.e,k,fixed);
	}

	if (Object.keys(filtered).length)this.log('attr-tranform',job.name, "finished attr transform");

	if (job.e.tagName.toLowerCase()=='script'){
	    //let attrK = job.e.getAttribute(`${prefix}attr-type`);
	    let attrK = lib.hash.get(section, 'type');
	    this.log('transform',job.name, `checking script... ${job.name} ${attrK}`);
	    
	    if(attrK && attrK.match(/text\/javascript/i)){
		
		this.log('transform',job.name,`running script ${job.name}`);
		if (0){ //this way is actually cleaner and probably better. but some EVal haters will hate it. add option later for it.
		    let rv = undefined;
		    try{
			console.log('in eval');
			rv = eval(job.e.text);
		    }catch(err){
			console.log('transform',job.name, 'EVAL ERROR: '+err.message)
		    }
		}else {
		    let clone = job.e.cloneNode(true);
		    clone.removeAttribute('id');
		    clone.removeAttribute('class');
		    lib.dom.set(clone, "data-for", job.name);
		    lib.dom.set(clone, "data-role", "spawn");
		    job.e.after(clone);
		}
		//SAFARI 15.4 ish FUCKED THIS UP
		//job.e.innerHTML = job.e.text;
	    }
	}


	return 1;
    },

    
   

    meetsRequirements(job){
	//if (!lib.hash.is(job) ) job=this.jobs[job];
	if(!(job = this.toJob(job)))return 0;
	if(job.load==1)return 0;
	

	let require = lib.array.to(lib.hash.get(job.ds,'require'),/\s+/);

	for (let name of require){
	    if (lib.hash.get(this.jobs, [name, "load"]) != 1)return 0;
	}
	return 1;
    },


    
    
    /* wraps a class function so it can easily be called externally,
       without needing to reference the class object.

       if you need to pass other args to it, use lib.func.preWrap or posWrap.
    */
    //function wrap
    wrap(fun){
	return function(obj){
	    return function(){return fun.call(obj,...arguments);}
	}(this);
    },


    

    _parseFunctions(job,line){
	let funcs  =lib.array.to(line,/\s+/),
	    out = [];
	for (let fun of funcs){
	    let parts = fun.split(/\:/);
	    let name = parts[0];
	    let args = parts.slice(1).join(':');
	    //let [name,args] = fun.split(/\:/,2);
	    args = lib.array.to(args,/\,/);
	    out.push({f:name,a:args});
	}
	return out;
    },
};

export default unfilteredTraits;
