export const trait_job = {
    toJob(ref) {
	return this.jobs.resolve(ref) || undefined;
    }
}

export default trait_job;
