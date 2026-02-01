export const submitTrait = {
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

};

export default submitTrait;
