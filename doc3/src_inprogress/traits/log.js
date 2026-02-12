export const logTraits = {
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
    },
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
};

export default logTraits;
