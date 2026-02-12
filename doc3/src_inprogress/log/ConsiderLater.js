//work in progress. - not actionable code , just scratch pad for time being.
error(data, opts = {}) {
    if (!this.enabled) return null;
    const w = this.bucket(this.defaultBucket);
    if (!w) return null;

    const rec = w.error(data, opts);

    // Manager-level throw policy lives here, not Worker
    if (this.throwOnError) {
        // If you want the "console.error(rec)" behavior, keep it.
        // Otherwise, rely on Worker printing logic and avoid duplicates.
        if (opts.printThrownRecord ?? false) {
            console.error(rec);
        }
        _throwLoggedError({
            manager: this,
            bucket: this.defaultBucket,
            record: rec,
            data,
            opts,
        });
    }

    return rec;
}

errorTo(bucketName, data, opts = {}) {
    if (!this.enabled) return null;
    const w = this.bucket(bucketName);
    if (!w) return null;

    const rec = w.error(data, opts);

    if (this.throwOnError) {
        if (opts.printThrownRecord ?? false) {
            console.error(rec);
        }
        _throwLoggedError({
            manager: this,
            bucket: bucketName,
            record: rec,
            data,
            opts,
        });
    }

    return rec;
}

//catch liek this

try {
    log.error({ msg: "bad stuff" }, { event: "db.write", cause: err });
} catch (e) {
    if (e && e.code === "E_LOG_THROW") {
        // structured access:
        console.log("bucket:", e.bucket);
        console.log("record:", e.record);
        console.log("original cause:", e.cause); // if supported / provided
    }
    throw e; // or handle
}
