const neoAsync = require('neo-async/async.min');

module.exports = function RateLimiterExtension(options) {
	/**
	 * The maximum number of total items across all queued buckets before enforcing a hard limit
	 * @type {number}
	 */
	let bucketLimit = options.bucketLimit || 10000;

	const FIFO = neoAsync.queue((item, done) => item()
		.then(() => done()).catch(error => done(error)), options.bucketSize || 10, 1);

	return {
		/**
		 * Mutate the configuration object to allow custom getters/setters for this plugin
		 * @param originalConfigRef
		 */
		extendConfiguration(originalConfigRef) {
			originalConfigRef.setBucketSize = (newSize) => { FIFO.concurrency = newSize };
			originalConfigRef.getBucketSize = () => FIFO.concurrency ;
			originalConfigRef.setBucketLimit = (newSize) => { bucketLimit = newSize };
			originalConfigRef.getBucketLimit = () => bucketLimit;
		},
		/**
		 * Allow overriding the fetch operation with additional modifications and/or mutations.
		 * This allows chaining, where each sender value is the result of the previous renderers
		 * @param sender
		 */
		applyToFetch(sender) {
			return (fullUrl, options) => new Promise((resolve, reject) => {
				if (FIFO.length() >= bucketLimit) {
					reject('Max limit reached. No further requests being accepted');
					return;
				}

				// Add to queue and handle errors on a per item basic
				FIFO.push(() => sender(fullUrl, options)
					.then(result => resolve(result))
					.catch(reject)
					// An escape hatch is added in-case of an internal failure (outside of Restie) is caught
				, (error) => error && reject(error));
			});
		},
	};
}
