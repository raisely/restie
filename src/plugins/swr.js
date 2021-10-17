module.exports = function RestieSWR(useSWR, depends = {}) {
	// Use optional dependency injection
	const React = depends.React || window.React;

	/**
	 * Helper hook for generating a key and fetcher argument for SWR.
	 * This will revalidate if options change or the model given has a
	 * new base url (.url) value
	 * @param modelOrArray The model to process, otherwise an array where the
	 *   first argument represents the model, and remaining arguments represent
	 *   shallow arguments to the hook
	 */
	function useRestieSWC(modelOrArray) {
		const [model, additionalArgs] = Array.isArray(modelOrArray) ?
			modelOrArray : [modelOrArray];

		// Store ref to previous additional args for comparison
		const additionalArgsString = JSON.stringify(additionalArgs);

		// Memoize SWR based on the model's base url and additional request
		// arguments (if present)
		const { key, fetcher } = React.useMemo(() => {
			const restieArgs = additionalArgs || [];

			return {
				key: [model.url, restieArgs],
				fetcher: (_url, options) => model.get(...options)
			}
		}, [model.url, additionalArgsString]);

		return { key, fetcher };
	}

	/**
	 * A wrapper hook around the useSWR hook that uses a Restie model and fetching
	 * mechanism in place of a typical one.
	 * @param modelOrArray The model to process, otherwise an array where the
	 *   first argument represents the model, and remaining arguments represent
	 *   shallow arguments to the hook
	 * @param swrOptions Optional options to pass to the SWR hook
	 */
	function useRestie(modelOrArray, swrOptions) {
		const { key, fetcher } = useRestieSWC(modelOrArray);
		return useSWR(key, fetcher, swrOptions);
	}

	return {
		/**
		 * Mutate the instance object to allow custom getters/setters for this plugin
		 * @param originalConfigRef
		 */
		extendInstance(restieInstance) {
			// Bind with aliases
			restieInstance.useModel = useRestie;
			restieInstance.useRestie = useRestie;
			// Also bind the internal hook for complex usage cases
			restieInstance.useRestieSWC = useRestieSWC;
		},
	};
}
