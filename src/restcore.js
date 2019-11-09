
import { basicRequestHandler } from './runtime';

/**
 * Helper responsible for concatenating 
 * @param  {...[type]} paths [description]
 * @return {[type]}          [description]
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
	if (typeof argsAsArray[0] !== 'string') {
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
 * @return {ModelInstance}           The model instance as a plain object
 */
function buildModel(apiRef, baseUrl, modelBase) {
	// concatenate the baseUrl passed with the specified root.
	// In the case of the first model, baseUrl will always represent the
	// unmodified REST api
	const modelRoot = concatPaths(baseUrl, modelBase);

	const modelInstance = {
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
		all: subModelBase => buildModel(apiRef, modelRoot, subModelBase),
		// allow recursing but with an additional child specifier
		one: (modelBase, id) => buildModel(apiRef, baseUrl, concatPaths(modelBase, id)),
	};

	return modelInstance;
}

/**
 * Instance builder for restcore. Invoked as a function
 * @param  {String} baseUrl The source url of the REST api or complex nested resource
 * @return {Object}         Object containing needed restful objects
 */
const buildRestcore = baseUrl => ({
	baseUrl,
	url: () => baseUrl,
	addRequestInterceptor(interceptor) { this.beforeSend = interceptor; },
	addResponseInterceptor(interceptor) { this.afterReceive = interceptor; },
	all(modelBase) { return buildModel(this, baseUrl, modelBase); },
	one(modelBase, id) { return buildModel(this, baseUrl, concatPaths(modelBase, id)); },
	custom(modelBase) { return buildModel(this, baseUrl, modelBase); },
});

export default buildRestcore;
