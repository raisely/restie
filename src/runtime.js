
// TODO look for let intensive query serializer?
import qs from 'qs';

/**
 * Takes a raw fetch response and tries to resolve JSON or plaintext
 * @param  {Response} rawRepsonse Response object from fetch
 * @return {Promise<Object|String|null>}    Resolves with either
 */
const getResultAsBestAttempt = async (rawRepsonse) => {
	const supportedTypes = ['json', 'text'];

	for (let index = 0; index < supportedTypes.length; index++) {
		const type = supportedTypes[index];

		try {
			// eslint-disable-next-line no-await-in-loop
			return await rawRepsonse[type]();
		// eslint-disable-next-line no-empty
		} catch (e) {}
	}

	return null;
};

/**
 * Generic runtime for making RESTful transactions
 * @param  {ApiInstance}    apiRef              The built api instance
 * @param  {String}    options.url         The url to content
 * @param  {...Object} options.baseOptions The configuration option
 * @return {Promise}                        [description]
 */
export async function basicRequestHandler(apiRef, { url, ...baseOptions }) {
	// if a beforeSend/afterSend is present 
	const options = apiRef.beforeSend ?
		{ ...baseOptions, ...apiRef.beforeSend(baseOptions) } :
		baseOptions;

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
		data: parsedResponse,
		headers: options.headers,
		method: options.method,
		statusCode: () => rawResponse.status,
		rawResponse,
	};

	// generate the final response depending on our detected request status (failed or good)
	// and if it's good, make sure we run any post-request code
	const finalResponse = (apiRef.afterReceive && isGoodResponse) ?
		{ ...responsePayload, ...apiRef.afterReceive(responsePayload, options) } :
		responsePayload;

	// add infamously weird shim for restful-js
	// TODO: add in plugs here for immutable extensions
	finalResponse.body = () => ({ data: () => responsePayload.data });

	// if we detected a bad response code, make sure we build a request error
	// and bubble the exception upwards. Restful seems to switch to certain
	// mutable values here so we'll flatten out any getter/closured values
	if (!isGoodResponse) {
		const error = new Error(rawResponse.statusText);
		finalResponse.statusCode = rawResponse.status;
		error.response = finalResponse;
		throw error;
	}

	return finalResponse;
}
