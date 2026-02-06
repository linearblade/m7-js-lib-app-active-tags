//engine/Buffer.js
export class Buffer {
    #value = null;
    #meta = {};

    constructor(initial = null) {
	this.#value = initial;
    }

    get() {
	return this.#value;
    }

    set(v, meta) {
	this.#value = v;
	if (meta && typeof meta === "object") {
	    Object.assign(this.#meta, meta);
	}
	return v;
    }

    clear() {
	this.#value = null;
	this.#meta = {};
    }

    meta() {
	return this.#meta;
    }

     toJSON() {
	return this.#value;
    }
}


export default Buffer;
