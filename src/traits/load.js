import Job from './Job.js';
//REQUIRES STACK CONSTRUCTION AND INTERVAL STAGING STILL.
//RUNNER == requires a reset job.

export const loadTraits = {
    load(sel=null){
	const list = this.bootSweep(sel);
	return this.registerJobs(list);
    },

    bootSweep(sel = null) {
	const input = sel ?? this.constructor.DEFAULT_SELECTOR;

	const targets = lib.dom.is(input)
	      ? [input]
	      : lib.array.to(input);

	const out = [];
	const seen = new Set();

	const push = (node) => {
	    if (!node || !lib.dom.is(node) || seen.has(node)) return;
	    seen.add(node);
	    out.push(node);
	};

	for (const t of targets) {
	    // direct DOM element
	    if (lib.dom.is(t)) {
		push(t);
		continue;
	    }

	    // treat as selector
	    const selector = String(t ?? '').trim();
	    if (!selector) continue;

	    const nodes = document.querySelectorAll(selector);
	    for (const n of lib.array.to(nodes)) push(n);
	}

	if (out.length === 0) return [];
	return out;
    },




    registerJobs(list) {
	const jobs = [];

	// Normalize anything array-like (NodeList etc) into a real array
	list = lib.array.to(list);

	for (let i = 0; i < list.length; i++) {
	    const tag = list[i];
	    if (!lib.dom.is(tag)) continue;

	    // Idempotent: if this element already has a job, return existing
	    const existing = this.jobs.getByElement ? this.jobs.getByElement(tag) : null;
	    if (existing) {
		jobs.push(existing);
		continue;
	    }

	    // Minimal job construction (no running)
	    const ds = this.getDataset(tag) || {};
	    const attr = {
		action: tag.getAttribute('action'),
		method: tag.getAttribute('method'),
	    };

	    const job = new Job({
		e: tag,
		ds,
		attr,
		type: "load",
		status: "ready",
		ws: {},
	    });

	    // Minimal config shaping (still safe: no run)
	    this.configureJob(job);

	    // Scheduler assigns id + stores it
	    const registered = this.jobs.register(job);

	    jobs.push(registered);
	}

	return jobs;
    },

    //$fixup --fill in  rewrite?
    remapLegacy(filtered){
        return filtered;
    },
    
    getDataset(tag){
        let filtered = lib.dom.filterAttributes(tag, /^data-/,1);
        filtered = this.remapLegacy(filtered);
        let exConf = this.getTagConfig(tag) || {};
        let ds = Object.assign(exConf, filtered);
        //console.log(exConf,filtered,ds);
        ds = lib.hash.inflate(ds,"delim=-");

        return ds;
    },

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



    
};



export default loadTraits;
