
import { basicRequestHandler } from './runtime';

/**
 * Contractual param check, throws TypeError if strict type mismatch
 * @param  {String} expectedType The string name of the expected type
 * @return {Function}            Checking function that throws on mismatch
 */
const expectStrictType = expectedType => (value) => {
	if (typeof value !== expectedType) {
		throw new TypeError(`expected ${expectedType} but got ${value}`);
	}

	return true;
}

const expectFunction = expectStrictType('function');

/**
 * Helper responsible for concatenating 
 * @param  {...String[]} paths Path name parts to concatenate
 * @return {String}          Joined path url
 */
const concatPaths = (...paths) => paths
	.map(path => `${path}`.replace(/^\//, ''))
	.join('/');

/**
 * Argument helper that allows omitting of first argument if not
 * of type string
 * @param  {Array} argsAsArray Argument array
 * @return {Array}             Modified array representing the filtered arguments
 */
const getArgsWithOptionalPath = (argsAsArray) => {
	const firstArgType = typeof argsAsArray[0];
	if (firstArgType !== 'string' && firstArgType !== 'number' ) {
		return [null, ...argsAsArray];
	}

	return argsAsArray;
};

/**
 * Model instance factory, representing the root methods of each REST
 * and nested REST model
 * @param  {ApiInstance} apiRef    The root api instance built
 * @param  {String} baseUrl   The root to append the modelBase to
 * @param  {String} modelBase The path/resource to append to the modelBase
 * @param  {Object|null} parentRef Reference to the higher scoped entity. Returns null if parent is the api
 * @return {ModelInstance}           The model instance as a plain object
 */
function buildModel(apiRef, baseUrl, modelBase, parentRef = null) {
	// concatenate the baseUrl passed with the specified root.
	// In the case of the first model, baseUrl will always represent the
	// unmodified REST api
	const modelRoot = concatPaths(baseUrl, modelBase);

	const modelInstance = {
		// ensure that the root of the model is visible for manual debugging
		url: modelRoot,
		get(...args) {
			const [path, params = {}, headers = {}] = getArgsWithOptionalPath(args);

			return basicRequestHandler(apiRef, {
				method: 'GET',
				url: path ? concatPaths(modelRoot, path) : modelRoot,
				params,
				headers,
			});
		},
		getAll(params = {}, headers = {}) {
			return basicRequestHandler(apiRef, {
				method: 'GET',
				url: modelRoot,
				params,
				headers,
			});
		},
		post(data = {}, params = {}, headers = {}) {
			return basicRequestHandler(apiRef, {
				method: 'POST',
				url: modelRoot,
				data,
				params,
				headers,
			});
		},
		patch(...args) {
			const [path, data = {}, params = {}, headers = {}] = getArgsWithOptionalPath(args);

			return basicRequestHandler(apiRef, {
				method: 'PATCH',
				url: concatPaths(modelRoot, path || ''),
				data,
				params,
				headers,
			});
		},
		put(...args) {
			const [path, data = {}, params = {}, headers = {}] = getArgsWithOptionalPath(args);

			return basicRequestHandler(apiRef, {
				method: 'PUT',
				url: concatPaths(modelRoot, path || ''),
				data,
				params,
				headers,
			});
		},
		delete(...args) {
			const [path, data = {}, params = {}, headers = {}] = getArgsWithOptionalPath(args);

			return basicRequestHandler(apiRef, {
				method: 'DELETE',
				url: concatPaths(modelRoot, path || ''),
				data,
				params,
				headers,
			});
		},
		// allow recursing
		all: subModelBase => buildModel(apiRef, modelRoot, subModelBase, modelInstance),
		// allow recursing but with an additional child specifier
		one: (subModelBase, id) => buildDualModel(apiRef, modelRoot, subModelBase, id, modelInstance),
		// allow obtaining parentRef (if exists)
		parent: () => parentRef,
		// get a ref to this api (useful if not nested)
		api: () => apiRef,
	};

	if (apiRef.configuration.enforceImmutability) {
		// prevent mutation of the model instance.
		// typically overkill, but useful in exposed client implmentations
		Object.freeze(modelInstance);
	}

	return modelInstance;
}

/**
 * Builds a hidden parent model needed for correct parent accessor
 * @param  {ApiInstance} apiRef    The root api instance built
 * @param  {String} baseUrl   The root to append the modelBase to
 * @param  {String} modelBase The path/resource to append to the modelBase
 * @param  {String|null} childModel The optional child path
 * @param  {Object|null} topParentRef Reference to the higher scoped entity. Returns null if parent is the api
 * @return {ModelInstance}           The model instance as a plain object
 */
function buildDualModel(apiRef, currentRootUrl, modelBase, childModel, topParentRef) {
	// build parent model
	const hiddenParentRef = buildModel(apiRef, currentRootUrl, modelBase, topParentRef)

	if (!childModel) {
		// if no childModel is specified, only return single parent layer
		return hiddenParentRef;
	}

	// otherwise, build and return child layer based off hidden parent
	// NOTE: will access this function via recursion, but will bail out since no
	// child is provided
	return hiddenParentRef.one(childModel);
}

/**
 * Instance builder for Restie. Invoked as a function
 * @param  {String} baseUrl The source url of the REST api or complex nested resource
 * @return {Object}         Object containing needed restful objects
 */
function buildRestie(baseUrl, userConfig = {}) {
	// shared configuration bound to the api instance
	const configuration = {
		enforceImmutability: userConfig.immutable === true,
		enabledCache: userConfig.cache === true,
		requestInterceptors: new Set(),
		responseInterceptors: new Set(),
		dataKey: typeof userConfig.dataKey === 'string' ? userConfig.dataKey : null,
	};

	const restieApiInstance = {
		configuration,
		baseUrl,
		url: () => baseUrl,
		addRequestInterceptor: interceptor => expectFunction(interceptor) && configuration.requestInterceptors.add(interceptor),
		addResponseInterceptor: interceptor => expectFunction(interceptor) && configuration.responseInterceptors.add(interceptor),
		removeRequestInterceptor: interceptor => configuration.requestInterceptors.delete(interceptor),
		removeResponseInterceptor: interceptor => configuration.responseInterceptors.delete(interceptor),
		all(modelBase) { return buildModel(this, baseUrl, modelBase); },
		one(modelBase, id) { return buildDualModel(this, baseUrl, modelBase, id); },
		custom(modelBase) { return buildModel(this, baseUrl, modelBase) },
	};

	if (configuration.enabledCache) {
		// add in cache store
		restieApiInstance.$cacheStore = new Map();

		// determine cache key building function
		configuration.cacheBy = typeof userConfig.cacheBy === 'function' ?
			// use user provided cache key
			userConfig.cacheBy :
			// use the default (method:url based) calculation
			({ fullUrl, options }) => `${options.method}:${fullUrl}`;
	}

	if (configuration.enforceImmutability) {
		// prevent mutation of the Restie instance
		Object.freeze(restieApiInstance);
		// prevent mutation of the configuration values
		Object.freeze(configuration);
	}

	// return instance reference
	return restieApiInstance;
}

export default buildRestie;
