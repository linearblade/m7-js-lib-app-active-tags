export const stackTrait = {
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

};

export default stackTrait;
