
import qs from 'qs';

/**
 * Global mapping for content types
 * @type {Object}
 */
const typeMap = {
	'application/json': 'json',
	'text/plain': 'text',
};

const extractContentTypeFromHeader = (rawContentType) => {
	const parts = rawContentType
		.split(';')
		.map(string => string.trim());

	return parts[0];
}

/**
 * Takes a raw fetch response and tries to resolve JSON or plaintext
 * @param  {Response} rawRepsonse Response object from fetch
 * @return {Promise<Object|String|null>}    Resolves with either
 */
const getResultAsBestAttempt = async (rawResponse) => {
	const ContentType = extractContentTypeFromHeader(rawResponse.headers.get('Content-Type') || '');

	// use response content-type to try and detect parse type
	const type = typeMap[ContentType] || 'text';

	try {
		return await rawResponse[type]();
	} catch (e) {
		return null;
	}
};

/**
 * Pre-request consolidation helper for preparing less intensive data
 * required for making a request.
 * @param  {Object}         apiRef              Reference to the parent Restie api object
 * @param  {String}         options.url         The user provided url to use
 * @param  {...Object}      options.baseOptions The base unprocessed options
 * @return {Object}         Object containing the fully generated url and processed options
 */
function prepareRequest(apiRef, { url, ...baseOptions }) {
	const options = { ...baseOptions };

	// progressive mutation based on interceptors
	apiRef.configuration.requestInterceptors
		.forEach(hook => Object.assign(options, { ...hook(options) }));

	options.headers = {
		Accept: 'application/json, text/plain, */*',
		'Content-Type': 'application/json',
		// enable overrides of header values
		...(options.headers || {}),
	};

	if (options.headers.Authorization === null) {
		// ensure null auth doesn't get serialized
		delete options.headers.Authorization;
	}

	// determine if we can send a payload and stringify the body if we can
	if (options.data && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)) {
		options.body = JSON.stringify(options.data);
	}

	// if query options are present, stringy and append to fetch's url
	const queryAsString = `?${qs.stringify(options.params || {})}`;
	const fullUrl = url.split('?')[0] + (queryAsString.length > 1 ? queryAsString : '');

	return { options, fullUrl };
}

/**
 * Request-phase. Consolidation of more intesive operations and results.
 *  -> During caching, this function is optimally only executed once.
 *  
 * @param  {Object} apiRef   Reference to the parent Restie api object
 * @param  {String} fullUrl  The full url to use in the async fetch operation
 * @param  {Object} options  The parsed options needed to make the request
 * @return {Promise<Object>} Resolves with object resembling the final payload
 */
async function commitRequest(apiRef, fullUrl, options) {
	// send out the request
	const rawResponse = await fetch(fullUrl, options);

	// make a best-effort (safe) guess if the request didn't go so well
	const isGoodResponse = rawResponse.status >= 200 && rawResponse.status < 300;

	// make a best-attempt effort at resolving a valid JSON/plaintext body from the
	// REST endpoint
	const parsedResponse = await getResultAsBestAttempt(rawResponse);

	// generate a generic form of the result payload before any post-resolve
	// code is run.
	const responsePayload = {
		headers: options.headers,
		method: options.method,
		statusCode: () => rawResponse.status,
		rawResponse,
	};

	// generate the final response depending on our detected request status (failed or good)
	// and if it's good, make sure we run any post-request code
	const finalResponse = { ...responsePayload };

	const { enforceImmutability, dataKey } = apiRef.configuration;

	// define data getter (as either mutable or immutable) based on configuration
	const data = enforceImmutability ? 
		// enforce immutability by providing a non-mutable reference to the original reponse payload
		() => JSON.parse(JSON.stringify(parsedResponse)) :
		// otherwise just return the default reference
		() => parsedResponse;

	if (!enforceImmutability) {
		// add mutable shorthand since due to ease of access
		finalResponse.data = parsedResponse;
	}

	// add infamously weird shim for restful-js
	finalResponse.body = () => ({ data });

	// add result helper for internal use
	finalResponse.result = () => dataKey ? data()[dataKey] : data();

	if (isGoodResponse) {
		// progressive mutation based on interceptors. Don't add any immutability here since we
		// can also extend basic functionality here
		apiRef.configuration.responseInterceptors
			.forEach(hook => Object.assign(finalResponse, { ...hook(finalResponse, options) }));

		// freeze result (if enabled) to prevent client mutation
		if (enforceImmutability) {
			Object.freeze(finalResponse);
		}
	} else {
		// if we detected a bad response code, make sure we build a request error
		// and bubble the exception upwards. Restful seems to switch to certain
		// mutable values here so we'll flatten out any getter/closured values

		const error = new Error(rawResponse.statusText);
		finalResponse.statusCode = rawResponse.status;
		error.response = finalResponse;

		// Call each error interceptor (if present)
		apiRef.configuration.errorInterceptors
			.forEach(hook => hook(error, fullUrl, options));

		throw error;
	}

	return finalResponse;
}

/**
 * Generic runtime for making RESTful transactions
 * @param  {Object} apiRef  Reference to the parent Restie api object
 * @param  {Object} options Base (non-processed) options for making the request
 * @return {Promise<Object>}        Resolves with object resembling the final payload
 * */
export async function basicRequestHandler(apiRef, options) {
	// prepare context for the request
	const prepared = prepareRequest(apiRef, options);

	// generate cache key (if enabled)
	const cacheKey = apiRef.$cacheStore ?
		apiRef.configuration.cacheBy(prepared) : null;

	if (!cacheKey) {
		// send up the request as default
		return commitRequest(apiRef, prepared.fullUrl, prepared.options);
	}

	// use cache method	to return existing pending promises if available
	const existingPromise = apiRef.$cacheStore.get(cacheKey);
	if (existingPromise) return existingPromise;

	// otherwise build a new one
	const pendingPromise = commitRequest(apiRef, prepared.fullUrl, prepared.options);
	// cache the pending promise
	apiRef.$cacheStore.set(cacheKey, pendingPromise);

	// wait for the pending result
	try {
		const finalResponse = await pendingPromise;
		// remove the promise ref from the store
		apiRef.$cacheStore.delete(cacheKey);
		// resolve with the result
		return finalResponse;
	} catch (error) {
		// something went wry, so delete the existing stored key before
		// bubbling the exception
		apiRef.$cacheStore.delete(cacheKey);
		throw error;
	}
}
