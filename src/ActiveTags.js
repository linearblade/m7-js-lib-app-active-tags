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


class activeTag099 {
    constructor(conf){
	this._log = [];
	this.intervals = {};
	this.jobCounter=0; //internal id for unique job id.
	this.jobs = {};
	this.ws={};
	this.conf = lib.hash.merge(
	    {
		debug:false,
		log:{
		    enable:false
		}
		
	    }
	    ,lib.hash.to(conf)
	);
    }

    parseStackLine(stackLine) {
	//const pattern = /at\s+(\S+)\s+\(eval\s+at\s+(\S+)\s+\(([^:]+):(\d+):(\d+)\),\s*<([^:]+):(\d+):(\d+)>\)/;
	const pattern = /at\s+(\S+)\s+\((\S+)\s+at\s+(\S+)\s+\(([^\)]+)\)\,([^:]+)\:(\d+)\:(\d+)/;
	const match = stackLine.match(pattern);
	if (match) {
            return {
		functionName: match[1],
		evalFunctionName: match[2],
		filePath: match[3],
		line: parseInt(match[4]),
		column: parseInt(match[5]),
		callerFilePath: match[6],
		callerLine: parseInt(match[7]),
		callerColumn: parseInt(match[8])
            };
	} else {
            return null;
	}
    }
     stackTrace(index=2) {
	// Create an Error object to capture the stack trace
	const stack = new Error().stack;
	 //console.log(stack);
	// Extract the stack trace as an array of strings
	const stackLines = stack.split('\n');

	// The caller's line number is in the third line of the stack trace
	// The first line is the Error message, the second line is where the Error was created
	 const callerLine = stackLines[index].trim();
	 //console.log('stack line');
	 //console.warn(callerLine);
	 //console.log('end stack line');
	 return (callerLine);
	 let parsed = this.parseStackLine(callerLine.trim());
	 if(!parsed)return {};
	 console.warn(parsed);
	 return {
	     file:parsed.callerFilePath,
	     line: parsed.callerLine
	 };
	// Extract the line number from the caller's stack trace line
	 //const lineNumber = callerLine.trim().split(':')[1];

	return lineNumber;
     }
    nonFatal(){
	let trace = this.stackTrace(3);
	if(arguments.length){
	    console.error(arguments[0]);
	    if (arguments.length>1)
		console.error(lib.args.slice(arguments,1));
	}

	//console.error(arguments,trace);
    }
    error(text){
	let trace = this.stackTrace(3);
	if(arguments.length){
	    console.error(arguments[0]);
	    if (arguments.length>1)
		console.error(lib.args.slice(arguments,1));
	}
	//console.error(arguments,trace);
	throw Error(trace);
    }
    warn(text){
	let trace = this.stackTrace(3);
	console.warn(arguments,trace);
	//console.warn(`${text}\n${trace}\n`);
    }
    //find tags by query selector
    load (selector = '[class*=script-]'){
	let list = lib.dom.is(selector)?
	    [selector]:
	    document.querySelectorAll(selector);
	if(!list)return;
	this.startRun(list);

    }
    findJobByDom(tag){
	if (!lib.dom.is(tag))
	    this.error("findJobByDom: tag is not dom",tag);
	for (let k in this.jobs){
	    if (this.jobs[k].e == tag)
		return this.jobs[k];
	}
	return null;
    }

    //this is not strictly necessary, you can just call load. but we need to build in interval stopping etc.
    resetJob(target,stack=null){
	let job  =lib.dom.is(target)?
	    this.findJobByDom(target):
	    this.jobs[target];
	if(!job)
	    return this.error('job not found',target);
	//$fixup you will still need to clear any intervals.
	delete (this.jobs[name]);
	this.load(job.e);
	if (lib.utils.isEmpty(stack))
	    return;
	
	if(lib.bool.isTrue(stack))
	    stack='main';
	this.runJob(job,stack);
    }

    //$fixup --clean / rename / prune. the works
    
    startRun (list){
	for (let i=0,tag=list[i]; i < list.length;tag=list[++i]){
	    console.log('constructing job for ',tag);
	    let job = this.makeJob(tag);
	    if(job)
		this.jobs[job.name] = job;
	    else this.error('startRun, ERROR CONSTRUCTING JOB');
	}
	this.log("load", "none",this.jobs);
	return;

    }

    //$fixup -- maybe prune. this may no longer be necessary. or rework.
    _makeBase(prefix="",section="",data="data-"){
	let out = data || "";;
	if(!lib.utils.isEmpty(prefix))out +=(lib.utils.toString(prefix,1)+'-').replace(new RegExp('\-+$'),"-");
	if(!lib.utils.isEmpty(section))out +=(lib.utils.toString(section,1)+'-').replace(new RegExp('\-+$'),"-");
	return out;
    }



    makeJob(tag,prefix="",type='load'){

	let ds, job;
	type = lib.utils.toString(type,1).toLowerCase();
	prefix = lib.utils.toString(prefix,1),prefix= prefix.substr(-1,1)=='-'?prefix.substr(prefix,prefix.length-1):prefix;
	ds = this.getDataset(tag) || {};
	let attr = {
	    action: tag.getAttribute('action'),
	    method: tag.getAttribute('method')
	};
	//console.log(`>>prepare tag=(ds:${ds.name}| tag:${tag.name} | i:${this.jobCounter})`,ds,tag);
	job = this.configureJob({
	    e:tag,
	    attr: attr,
	    ds:ds,
	    ws:{},
	    status:'ready',
	    load:0
	});

	job.stack ={};
	let list =lib.hash.get(job.ds,"tasklist") 
	list = list?lib.array.to(list, /\s+/):["this"];
	for (let item of list){
	    if(lib.utils.toString(item,1).toLowerCase()=="this")
		this.pushStackStandard('main',job);
	    else this.pushStackStandard('main',job,item);
	}
    
	this.pushStack('main',job,"complete");
	if(lib.hash.get(job.ds,"interval") && !lib.bool.isTrue(lib.hash.get(job.ds,"interval.disabled"))  )
	    this.pushStack('main',job, "intervalStart",job.ds.interval);


	this.pushStack('main',job,"runAll");
	return job;

    }

    //this.pushStack(job, 'request', undefined,'request');
    //this.pushStack(job,'request', rec);
    //function pushStack
    
    pushStack(stackName,job, type, rec,section,opts){
	//console.log(arguments);
	if(lib.utils.isEmpty(stackName))return 0;	
	opts = lib.hash.to(opts,'extra');
	opts.stackName = stackName;

	if(!(job = this.toJob(job)))return 0;
	let stack = lib.hash.get(job,['stack',stackName])||[];
	this.log("pushStack",job.name,`preparing ${name}`,`>>STACK IS ${stackName} ${type} ${section}`, stack);
	let target;
	this.log("pushStack", job.name, "rec is ", rec);
	if(lib.hash.is(rec) ){
	    
	    target= (section)?rec[section]:rec;
	    if (!target){
		this.warn(`(hash)empty subsec (${section}), cannot push to stack `,rec,type,target);
		return 0;
	    }
	}else{
	    if(rec){
		target=section?[rec,section].join('.'):rec;
	    }else target=section;

	    //console.log('target is',target, job.ds);
	    if (!lib.hash.get(job.ds,target)){
		this.warn(`cannot push to (${job.name})\n\tstack: ${stackName}\n\ttype: ${type}\n\ttarget: ${target}\n`);
		return 0;
	    }//else console.log('PUSHED', target);
	    //$FIXUP : undefined targets are let through. this is unintended but working.
	    //fix in next revision
	}

	let item ={f:type,t:target,opts:opts,s:section};
	stack.push(item);
	//console.log(`>>STACK NOW ${stackName}`, stack);
	lib.hash.set(job,['stack',stackName],stack);
	return 1;
    }

    //pushes the typical tasks to a job stack. may reduire additional items.

    pushStackStandard(stackName, job,prefix,section, extra){

	this.pushStack(stackName,job,'request',prefix, 'request', extra);
	this.pushStack(stackName,job,'chain',prefix, 'response', extra);
	this.pushStack(stackName,job,'chain',prefix, 'pre', extra);
	this.pushStack(stackName,job,'attr',prefix, 'attr', extra);
	this.pushStack(stackName,job,'chain',prefix, 'post', extra);
	return;


    }
    //$fixup -rename
    configureJob(job){
	let name = lib.hash.get(job.ds,"name") || job.e.name || this.jobCounter;
	job.ds.name=name;
	this.log("load",name,`preparing ${name}`,job.ds);
	this.jobCounter++;
	job.name =name;
	let base = this._makeBase(job.prefix);
	//let url =lib.dom.get(job.e, `${base}request-action`) || lib.dom.get(job.e,'action') || undefined;
	let url = lib.hash.get(job.ds,'request.action' ) || lib.hash.get(job.attr,'action');
	//console.log(`HERE ${job.name} ${url} `,job.ds.request);
	if(url && !job.ds.request){
	    //console.log('HERE CONSTRUCT DUMMY REQUEST');
	    job.ds.request= {};
	}
        //lib.hash.set(job,"ds.request.url", lib.str.interp(url, this.interpScheme({obj:this,item:job},undefined) ));
	//lib.hash.set(job,"ds.request.url", url);
	//if(lib.utils.isEmpty(lib.hash.get(job,"ds.request.urlencoded")))lib.hash.set(job,"ds.request.urlencoded", 1);
        //lib.hash.set(job,"ds.request.method", lib.dom.get(job.e, `${base}request-method`) || lib.dom.get(job.e,'method') || undefined);

        if(lib.hash.is(lib.hash.get(job,"ds.response"))){
	    job.ds.response.json= lib.bool.isTrue(job.ds.response.json)?1:0 ;
            if(!job.ds.response.src) job.ds.response.src = job.ds.response.json? "request:jsonData":"request:responseText";
        }
        if (lib.hash.is(lib.hash.get(job,"ds.pre")) && !job.ds.pre.src)job.ds.pre.src="this:innerHTML";
	if (lib.hash.is(lib.hash.get(job,"ds.post")) && !job.ds.post.src)job.ds.post.src="this:innerHTML";
	return job;
    }
    //$fixup --fill in  rewrite?
    remapLegacy(filtered){
	return filtered;
    }
    getDataset(tag){
	let filtered = lib.dom.filterAttributes(tag, /^data-/,1);
	filtered = this.remapLegacy(filtered);
	let exConf = this.getTagConfig(tag) || {};
	let ds = Object.assign(exConf, filtered);
	//console.log(exConf,filtered,ds);
	ds = lib.hash.inflate(ds,"delim=-");
	
	return ds;
    }
    

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
    }
    runFunctions(job,load,error,ws){
	if(!(job = this.toJob(job)) ){this.error('no job found');return 0;}
	load =  this._parseFunctions(job,load) ;
	error =this._parseFunctions(job,error ,0)  ;
	//console.log(load,error);
	let rv = this._runFunctions(job,load,error,ws);
	return rv;
    }

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
	
    }


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

    }
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


    }
    
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
    }

    markComplete(job){
	if(!lib.hash.is(job))job = this.jobs[job];
	if (!job) return 0;
	return job.load= 1;
    }
    toJob(job){
	if(!lib.hash.is(job))job = this.jobs[job];
	return job?job:undefined;
    }
    
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
    }

    setRunning (job,stackName, state,rv=0){
	if(!(job = this.toJob(job))) return this.error('setRunning: no job found');
	lib.hash.set(job.ws,["stackRun",stackName],state);
	return rv;
    }
    getRunning (job,stackName){
	if(!(job = this.toJob(job))) return this.error('getRunning: no job found');
	return lib.hash.get(job.ws,["stackRun",stackName]);
    }
    
    
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

    
    }
    //$fixup -- prune/rewrite
    submitForm(e){
	let form,dataConfirm,url,load,error,urlencoded=1,method,body,ws,item,job,ds, onSubs,name;

	ds = this.getDataset(e);
	//console.log(ds);
	//return;
	//console.log('>>HERE' ,e);
	form = lib.dom.form.collect(e);
	if (!form)return;
	//until here good
	//find the object item or bail out.
	//console.log('matching it up');
	for (let name in this.jobs){
	    //console.log(name,this.jobs[name].e,form.form);
	    if(this.jobs[name].e==form.form){
		job=this.jobs[name];
		break;
	    }
	}

	

	if (!job)return this.error('element triggered is not attached to a parent',e);


	/*begin - pre flight check list*/
	dataConfirm = ds.confirm || job.ds.confirm;
	if (!lib.utils.isEmpty(dataConfirm) && !confirm(dataConfirm)) {
	    this.warn('confirm() returned false. cancelling execution');
	    return false;
	}
	/*end - pre flight check list */

	let parseVar = (data,parent,current)=>{
	    if(lib.utils.isEmpty(data))return undefined;
	    if(lib.hash.is(data))return data;
	    let [a,b] = lib.utils.toString(data,1).toLowerCase().split(':',2);
	    //console.log(`a : ${a}, b: ${b}`,parent,current);
	    if(!b)return a=='parent'?parent:current;
	    return lib.hash.get(a=='parent'?parent:current,b);
	    //if(a !='parent')return lib.hash.get(current,b);
	    //return lib.hash.get(parent,b);
	};
	/*begin - processing prior to running a request*/
	//let filtered = lib.dom.filterAttributes(e,/^data-on-/,1);
	//let filtered = ds.on || lib.hash.to({});
	let filtered = parseVar(ds.on,job.ds,ds);
	//console.log('>>',filtered);
	if(lib.hash.get(filtered,'submit')){
	    filtered['load'] = filtered['submit'];
	    delete (filtered['submit']);
	}
	
	if (!this.runChain(job, filtered,{e:e} ) ){
	    this.error(`onsubmit ${job.name}, flow control returned a false value, interrupting execution`);
	    return false;
	}
	//let response = e.getAttribute('data-response')?e.getAttribute('data-response'):lib.dom.filterAttributes(e,/^data-response-/,1);
	
	let response = parseVar(ds.response, job.ds,ds);
	let stackName = ds.stack || 'formclick';


	//$FIXUP this is a bad hack. cleanup later
	if(1 || lib.bool.isTrue(ds.force)){
	    job.stack[stackName] = [];
	    job.status='ready';
	    this.setRunning(job,stackName,0);
	}
	//$fixup -- this seems like an awefully easy patch fix. not sure why it wasnt done. so you may need to undo it later...
	if(lib.utils.isEmpty(ds.response))ds.response="response"; 
	if(!ds.tasklist){
	    let section = Object.assign({
		request:'request'
	    },ds);
	    //console.log(section);
	    this.pushStackStandard(stackName,job,section,undefined, {form:form,e:e,body:ds.body} );
	    //this.pushStack(stackName,job, 'request',undefined,'request',{form:form});
	    //this.pushStack(stackName,job,'chain', response);

	}else {
	    let list = lib.array.to(ds.tasklist,/\s+/);
	    for (item of list){
		let lc = lib.utils.toString(item,1).toLowerCase();
		let section = undefined;
		if (lc=='this'){
		    section = Object.assign({
			request:'request'
		    },ds);
		    ///this.pushStackStandard(stackName,job,section,undefined, {form:form,e:e,body:ds.body} );
		    //this.pushStack(stackName,job, 'request',undefined,'request',{form:form,body:ds.body});
		    //this.pushStack(stackName,job,'chain', response,undefined,{e:e});
		}else if (lc=='parent'){
		    //let section = undefined;
		    section = Object.assign({
			request:'request'
		    },ds);
		    //console.log('>>'+item+'<<',section);
		    //this.pushStackStandard(stackName,job,section,undefined, lc.match('parent')?undefined:{form:form,e:e,body:ds.body} );
		}else {
		    //let section = parseVar(item, job.ds,ds);
		    section = item;
		    //console.log('>>'+item+'<<',section);
	
		}
		//this.pushStackStandard(stackName,job,section,undefined, lc.match('parent')?undefined:{form:form,e:e,body:ds.body} );
		this.pushStackStandard(stackName,job,section,undefined, lc.match('parent')?{e:e}:{form:form,e:e,body:ds.body} );

	    }
	}
	this.log('submitForm', job.name, `>>running ${job.name}  stack ${stackName}`,job.stack[stackName]);
	this.runJob(job,stackName);
	return false;

	
    }



    //$function getTagConfig
    getTagConfig(tag){
	let target = tag.getAttribute('data-config');

	let scheme = this.interpScheme({e:tag},undefined);
        target = lib.str.interp(target, scheme);


	let element = undefined;
	if(lib.utils.isEmpty(target))return undefined;

	let list = lib.array.to(target, /\s+/);
	let data = {};
	for (let item of list){
	    let info =this.parseTarget({e:tag},item);
	    let val = lib.utils.isScalar(info) || lib.dom.is(info)?info:(lib.hash.is(info) && info.src && info.prop)?lib.hash.get(info.src,info.prop):info;
	    //console.log(`>>getconfig (${item})`,val);
	    let newData = undefined;
	    if (lib.dom.is(val)){
		let text = val.text;

		if ( (val.type+"").match('eval')){
		    //try to eval it
		    newData= eval(text);
		}else {
		    newData= lib.json.parse(text);
		    
		}
	    }
	    data = lib.hash.merge(data, lib.hash.to(newData));
	    
	}

	return data;
    }
    
    //$function log
    log(type,name){
	if(!lib.bool.isTrue(lib.hash.get(this.conf,'log.enable')))
	    return;
	//let job = this.toJob(name);
	//if(job && lib.bool.isFalse(job.ds.logging) )
	//    return;
	let record = {type:type, name:name, args:lib.args.slice(arguments,2)};
	this._log.push(record);
	if (this.debug)console.log(...arguments);
    }
    //$function showlog
    showLog(type,name){
	if(!lib.bool.isTrue(lib.hash.get(this.conf,'log.enable')) )
	    return console.log('logging disabled. set conf.log.enable = 1');
	console.log(` checking ${type} / ${name}`);
	for (let rec of this._log){
	    if(type && !rec["type"].match(type) )continue;
	    if (name && !(""+rec["name"]).match(name) ) continue;
	    console.log(rec);
	}
    }

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
	
    }

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
    }

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
    }

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
    }
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
	
    }

    
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
    }

    
   

    meetsRequirements(job){
	//if (!lib.hash.is(job) ) job=this.jobs[job];
	if(!(job = this.toJob(job)))return 0;
	if(job.load==1)return 0;
	

	let require = lib.array.to(lib.hash.get(job.ds,'require'),/\s+/);

	for (let name of require){
	    if (lib.hash.get(this.jobs, [name, "load"]) != 1)return 0;
	}
	return 1;
    }


    

    


    interpScheme(job,custom={}){
	//$fixup workspace to job compatibility hack
	if (lib.hash.is(job) && ('item' in job) && ('obj' in job)){
	    //console.log('legacy hack!');
	    job = job.item;
	}else job=this.toJob(job);

	let obj = this;
	//console.log('PREPARINGINTERP SCHEME',custom);
	return function(target){
	    let info = obj.parseTarget(job,target,custom);
	    //console.log('INSIDE SCHEME',info,lib.hash.is(info));
	    //$$fixup
	    //console.log(info);
	    if(lib.utils.isScalar(info))return info;
	    return (lib.hash.is(info) && info.src && info.prop)?
		lib.hash.get(info.src, info.prop):
		undefined;
	}
    }
    
    //parseTarget(target,ws,r,custom={}){
    //$function parseTarget
    parseTarget(job,target,custom={}){
	job = this.toJob(job);
	if(!target)return undefined;
	let splitter = function (str, exp=/\s+/,count=0){
	    str = lib.utils.toString(str,1);
	    let pos = str.indexOf(':');
	    return [str.substr(0,pos),pos>-1?str.substr(pos+1):undefined];

	};

	
	let data;
	//let [type,loc] = target.split(/:/,2);
	let [type,loc] = splitter(target);
	if (!type) return undefined;
	type = (type+"").toLowerCase();
	let disp = {
	    "inline": () =>{
		return {
		    src: job.e,
		    prop: "innerHTML",
		    special: loc
		}
	    },
	    "request": ()=>{
		return {
		    src: job.r,
		    prop: loc
		}
	    },
	    "window": () =>{
		return {
		    src: window,
		    prop: loc
		}
	    },
	    "this":  () =>{
		return {
		    src: job.e,
		    prop: loc
		}
	    },
	    "ws":  () =>{
		//console.log(`>>ws.${loc}=`+lib.hash.get(job.ws,loc));
		
		return {
		    src: job.ws,
		    prop: loc
		}
	    },
	    "buffer": () =>{
		return{
		    src:job.buffer,
		    prop:loc
		};
	    },
	    "ds":() =>{
		return {
		    src:job.ds,
		    prop: loc
		}
	    },
	    "find": () =>{
		let result = undefined;
		//console.log('running find on ',job.e,loc);
		try{
		    result = job.e.querySelector(loc);
		    if(!result && job.e.matches(loc))result = job.e;

		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with querySelector('${loc}')`,job);
		}
		if(!result)this.warn(`couldnt find element with e.querySelector('${loc}')`);
		return result;
	    },
	    "doc": () =>{
		let result = undefined;
		try{
		    result = document.querySelector(loc);
		}catch{
		    result = undefined;
		    this.warn(`error with  querySelector(selector '${loc}')`);
		}
		if(!result)this.warn(`couldnt find element with document.querySelector('${loc}')`);
		return result;
	    },
	    "closest": ()=>{
		let result = undefined;
		try{
		    result = job.e.closest(loc);
		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with closest(selector '${loc}' )`);
		}
		return result;

	    },
	    "form": ()=>{
		let form = lib.dom.form.collect(job.e);
		if(!form) return undefined;
		for (let row of form.parms){
		    if (row[0] == loc)return row[1];
		}
		return undefined;
	    },
	    "default": () =>{
		return undefined;
	    }
	};

	if (lib.hash.is(custom) && type in custom){
	    return custom[type](loc);
	}else {
	    if (!(type in disp))type="inline";
	    return disp[type]();
	}
    }
    //evaluates a target variable.
    evalTarget(job, target,custom){
	let parse = this.parseTarget(...arguments);
	return this.evalParse(parse);
    }

    
    //maybe we delete this
    evalParse(parse){
	//console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src)?lib.dom.get(parse.src, parse.prop):lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    }
    
    /* wraps a class function so it can easily be called externally,
       without needing to reference the class object.

       if you need to pass other args to it, use lib.func.preWrap or posWrap.
    */
    //function wrap
    wrap(fun){
	return function(obj){
	    return function(){return fun.call(obj,...arguments);}
	}(this);
    }


    
    //the following are class functions because I have defined this function in varying formats throughout other libs.
    //and because I dont want to include those better and generalized functions etc at the moment.
    _filterDataset(data, regex = /^attr(.+)$/i){
	let filtered={};
	for (k of  Object.keys(data)){
	    let m = k.match(regex);
	    if (!m)continue;
	    filtered[m[1]] =data["attr"+m[1]];
	}
	return filtered;
    }

    //build function array with args from user defined functions
    //function _getFunctions
    //$FIXUP - prune
    _getFunctions(line,debug=0){
	let list = this._parseFunctions(line);
	let out = [];
	if(debug)this.warn(`parsing `+line);
	for (let rec of list){
	    if(debug)this.warn('pushing ',rec);
	    out.push( lib.func.postWrap(rec.f,rec.a));
	}
	if(debug)this.warn(`got ${out.length} functions`,out);
	return out;
    }
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
    }

}


