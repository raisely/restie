/*
 * Converts an openapi schema into a Restie method tree
 */

/**
 * Will convert an openapi schema into an array containing individual paths and methods
 * mapped out to valid Restie paths
 * @param schemaToConvert The openapi 3 schema to process
 * @param root The Restie api root name (defaults to api
 * @return {Array<Object>} Set of mappings
 */
function mapFromOpenApiSchema(schemaToConvert, root = 'api') {
	// mapping of original route names and their equivalent restie tree cal
	const restieTreeMap = [];

	// for each path definition
	Object.keys(schemaToConvert.paths).forEach((rawPath) => {
		const allMethods = Object.keys(schemaToConvert.paths[rawPath]);
		const rawPathParts = rawPath.split('/');

		// Sneaky way to detect if we should nest an additional level, or append
		// the helper call.
		const onlyOneMethod = allMethods.length === 1;

		// generate alias
		allMethods.forEach((method) => {
			const preferMethodAppend = onlyOneMethod && method !== 'post';

			// generate essential parts for the restie path
			const structuredParts = convertRawPartsIntoRestiePath(rawPathParts, preferMethodAppend);
			const appendMethod = generateAppendMethod(method, preferMethodAppend, rawPathParts);

			// push to map
			restieTreeMap.push({
				originalPath: rawPath,
				method,
				generated: `${root}.${structuredParts.join('.')}.${appendMethod}`,
			});
		});
	});

	return restieTreeMap;
}

/**
 * Checks to see if a path part is likely a path parameter
 * @param value
 * @return {*|boolean}
 */
const isPathParameter = value => value.startsWith('{') && value.endsWith('}');

/**
 * Will convert a set of paths converting it to a valid Restie chain
 * @param pathParts The split apart openapi path
 * @param preferMethodAppend Determines if we should not use an .all(), and instead default to
 *   using generateAppendMethod to generate the last path value
 * @return {Array<string>} Set of path chunks representing the root Restie chain
 */
function convertRawPartsIntoRestiePath(pathParts, preferMethodAppend = false) {
	// start assembling an array from back to front
	const processedParts = [];

	let index = pathParts.length;

	while (index--) {
		// Index both current and previous value
		const currentPart = pathParts[index];
		const forwardPart = pathParts[index - 1];

		if (currentPart === '') {
			// skip first element
			continue;
		}

		if (isPathParameter(currentPart)) {
			if (forwardPart && !isPathParameter(forwardPart)) {
				processedParts.unshift(`one('${forwardPart}', '${currentPart}')`);

				// we've merged so move the index point an additional place
				index -= 1;
				continue;
			}
		} else if (preferMethodAppend && index === pathParts.length - 1) {
			// For usability, if an endpoint only has a single action, if supported
			// we should opt for just prepending a path in the appropriate method call
			// instead of doing .all(). This only applied to the final part of a handle
			// (last index)
			continue;
		}

		processedParts.unshift(`all('${currentPart}')`);
	}

	return processedParts;
}

/**
 * Absolves the correct method call to use based on the method and options provided
 * @param method The intended method of the api call
 * @param preferMethodAppend Determines if we should intentioanlly opt for prepending the path
 *   slug if supported
 * @param pathParts The split apart openapi path
 * @return {string} The method string to be appended
 */
function generateAppendMethod(method, preferMethodAppend, pathParts) {
	const lastPart = pathParts[pathParts.length - 1];

	// Determine if we should not use getAll
	const isGetAll = method === 'get' && !preferMethodAppend && !isPathParameter(lastPart);

	// Start building individual parts of the method call
	const selectedMethod = isGetAll ? 'getAll' : method;
	const parts = [`${selectedMethod}(`];

	if (preferMethodAppend) {
		// add the property as a path indicator
		parts.push(`'${lastPart}', `);
	}

	parts.push(({
		get: 'params = {}, headers = {}',
		getAll: 'params = {}, headers = {}',
		patch: 'data = {}, params = {}, headers = {}',
		post: 'data = {}, params = {}, headers = {}',
		put: 'data = {}, params = {}, headers = {}',
		delete: 'data = {}, params = {}, headers = {}',
	})[selectedMethod], ')');

	return parts.join('');
}

module.exports = mapFromOpenApiSchema;