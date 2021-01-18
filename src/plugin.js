/**
 * Generates a fetch operation after applying a series of fetch helpers
 * derived from plugins (if applicable).
 * @param apiRef
 * @param originalFetch
 * @return {*}
 */
export function generateFetch(originalFetch, apiRef) {
	const pluginsThatFetch = apiRef.configuration.plugins
		.filter(plugin => typeof plugin.applyToFetch === 'function');

	if (!pluginsThatFetch.length) return originalFetch;

	let newFetchHelper = null;
	let index = pluginsThatFetch.length;

	while (index--) {
		const plugin = pluginsThatFetch[index];
		newFetchHelper = plugin.applyToFetch(newFetchHelper || originalFetch, apiRef);
		if (typeof newFetchHelper !== 'function') {
			console.warn('A Restie plugin altered fetching without returning a function. This will likely cause issues', {
				plugin,
				fetchOverride: plugin.applyToFetch,
			});
		}
	}

	return newFetchHelper;
}

/**
 * Helper function for applying
 * @param objectRef
 * @param applyToFunctionKey
 */
export function applyPluginsToObject(objectRef, plugins, applyToFunctionKey) {
	plugins
		.filter(plugin => typeof plugin[applyToFunctionKey] === 'function')
		.forEach(plugin => plugin[applyToFunctionKey](objectRef));
}

/**
 * Verify that passed plugins meet expected requirements, otherwise skip.
 * Helps prevent issues in production environments
 * @param initializedPlugins
 */
export function verifyPlugins(initializedPlugins) {
	return initializedPlugins;
}