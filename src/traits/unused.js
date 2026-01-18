export const  unusedTraits = {
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
    },

    
    //$fixup -- maybe prune. this may no longer be necessary. or rework.
    _makeBase(prefix="",section="",data="data-"){
	let out = data || "";;
	if(!lib.utils.isEmpty(prefix))out +=(lib.utils.toString(prefix,1)+'-').replace(new RegExp('\-+$'),"-");
	if(!lib.utils.isEmpty(section))out +=(lib.utils.toString(section,1)+'-').replace(new RegExp('\-+$'),"-");
	return out;
    }


};

export default unusedTraits;
