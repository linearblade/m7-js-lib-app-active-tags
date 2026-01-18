export const cropped = {
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

    },

    

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

    },

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
    },

    
    findJobByDom(tag){
	if (!lib.dom.is(tag))
	    this.error("findJobByDom: tag is not dom",tag);
	for (let k in this.jobs){
	    if (this.jobs[k].e == tag)
		return this.jobs[k];
	}
	return null;
    },

        

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



    


};
