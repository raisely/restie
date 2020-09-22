
const timeoutDelay = duration => () => new Promise(resolve => setTimeout(resolve, duration));

module.exports = function RateLimiterExtension(options) {
	// scope re-configurable values at this level
	// this is because the Restie api instance (and it's configurations)
	// is sometimes configured to be immutable

	/**
	 * The maximum concurrency in a batch
	 * @type {number}
	 */
	let bucketSize = options.bucketSize || 10;

	/**
	 * The maximum number of total items across all queued buckets before enforcing a hard limit
 	 * @type {number}
	 */
	let bucketLimit = options.bucketLimit || 10000;

	/**
	 * The minimum amount of time (ms) that should elapse (from the start of one bucket batch) before the start of another
	 * @type {number}
	 */
	let bucketTimeWindow = options.bucketDelay || 0;

	/**
	 * The time quantization (ms) that will delay in before the FIFO queue starts to empty (debounce)
	 * @type {number}
	 */
	let bucketGroupingWindow = 10;

	/**
	 * Storage for FIFO task queue. Limit is prescribed by usage of bucketLimit. Each task represents a consolidated
	 * request stored for batching based on the bucketSize configured.
	 * @type {Function[]}
	 */
	const queued = [];

	/**
	 * Ref to the current overload timeout. When full - will process of emptying out the FIFO queue.
	 * @type {TimerHandler|null}
	 */
	let overloadTimeout = null;

	/**
	 * Ref to the actively running batch promise. Used to defer running additional batch processing
	 * until the currently executing one has finished processing.
	 * @type {Promise}
	 */
	let currentBatchPromiseRef = Promise.resolve();

	/**
	 * Batching operation. Clears queue in FIFO order and resolves tasks via internallly bound refs
	 * @return {Promise<void>}
	 */
	const startBatching = async () => {
		// ref to current batch to be executed
		let currentBatch = [];

		const performCurrentBatch = async () => {
			if (bucketTimeWindow) currentBatch.push(timeoutDelay(bucketTimeWindow));
			await Promise.all(currentBatch.map(task => task()));
		}

		// popped ref to first item in queue (FIFO)
		let current = queued.shift();

		while (current) {
			currentBatch.push(current);

			if (currentBatch.length === bucketSize) {
				// run batch at maximum concurrency
				await performCurrentBatch();
				// eslint-disable-next-line require-atomic-updates
				currentBatch = [];
			}

			// get next item item in queue while popping front-most item (FIFO)
			current = queued.shift();
		}

		if (currentBatch.length) {
			// (remainder) less than max concurrency - so just execute the remaining items
			await performCurrentBatch();
		}

		// Force GC on batched items
		// eslint-disable-next-line require-atomic-updates
		currentBatch = null;
	};

	const addAndWaitForExecution = (task) => new Promise((resolveTask, rejectTask) => {
		if (overloadTimeout) {
			clearTimeout(overloadTimeout);
			overloadTimeout = null;
		}

		if (queued.length === bucketLimit) {
			rejectTask(new Error('Limit reached in queued requests'));
			return;
		}

		// add task to front of queue
		queued.unshift(() => task().then(resolveTask).catch(rejectTask));

		// once batch execution is finished processing then proceed to next batch
		currentBatchPromiseRef.then(() => {
			if (overloadTimeout) clearTimeout(overloadTimeout);
			overloadTimeout = setTimeout(() => {
				currentBatchPromiseRef = startBatching();
			}, bucketGroupingWindow);
		});
	});

	return {
		/**
		 * Mutate the configuration object to allow custom getters/setters for this plugin
		 * @param originalRef
		 */
		extendConfiguration(originalConfigRef) {
			originalConfigRef.setBucketSize = (newSize) => { bucketSize = newSize };
			originalConfigRef.getBucketSize = () => bucketSize;
			originalConfigRef.setBucketLimit = (newSize) => { bucketLimit = newSize };
			originalConfigRef.getBucketLimit = () => bucketLimit;
			originalConfigRef.setBucketTimeWindow = (newSize) => { bucketTimeWindow = newSize };
			originalConfigRef.getBucketTimeWindow = () => bucketTimeWindow;
		},
		/**
		 * Allow overriding the fetch operation with additional modifications and/or mutations.
		 * This allows chaining, where each sender value is the result of the previous renderers
		 * @param sender
		 */
		applyToFetch(sender) {
			return async (fullUrl, options) => {
				const result = await addAndWaitForExecution(() => sender(fullUrl, options));
				return result;
			}
		},
	};
}
