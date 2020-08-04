/**
 * Sends a huge batch of requests to a mocked Restie model
 * @param apiModel The restie model to
 * @param total The total number of requests to send
 * @param method The method to use
 * @return {Promise<[Results]>} Array of Restie results, corresponding to the total provided
 */
async function sendRequestWave(apiModel, total, method = 'get'){
	const requests = [];
	let totalRequests = total;
	while (totalRequests--) requests.push(apiModel[method]());
	return Promise.all(requests);
}

/**
 * Basic wait helper which pauses async thread on event loop - useful for timed/caching tests
 * @param duration The approximate amount of milliseconds to wait on the event loop
 * @return {Promise<undefined>}
 */
const pause = (duration) => new Promise(resolve => setTimeout(resolve, duration));

/**
 * Runs result on all provided values
 * @param results
 * @return {object[]}
 */
const getBatchResults = results => results.map(res => res.result());

module.exports = {
	sendRequestWave,
	pause,
	getBatchResults
};