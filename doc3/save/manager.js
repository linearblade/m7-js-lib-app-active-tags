/*
 * Copyright (c) 2025 m7.org
 * License: MTL-10 (see LICENSE.md)
 */
function install(sys, ctx){
    console.log('installing lib');
    const pkgId = ctx?.pkg?.id;
    if(!pkgId){
	console.warn('no package id found for lib, cannot proceed with install!');
	return;
    }
    
    let lib = bootstrap.data.getPackageModule(pkgId,'lib').content;
    window.lib = lib;
    console.log(sys,ctx);
}

function destroy(sys,ctx){
    console.warn('destroying');
    window.lib = null;
}
export default {
    install , destroy
    
};
