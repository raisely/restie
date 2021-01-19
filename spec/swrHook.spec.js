const restie = require('../dist/restie');
const restieSwcPlugin = require('../dist/plugins/swr');
const test = require('./helpers/assertions');
const getServer = require('./helpers/testServer')();
const fakeDB = require('./helpers/fakeDB');

const useSWR = require('swr').default;

global.fetch = require('node-fetch');

const {
	renderHook,
} = require('@testing-library/react-hooks');

describe('SWR support', () => {
	// Setup mock browser environment
	require('jsdom-global')();

	const crudLayer = fakeDB()[1]

	it('basic hook configuration (normal/singular)', async () => {
		const [apiUrl] = await getServer((app) => {
			// define vegetable endpoint with generic id
			app.get('/foods/vegetables/:uuid', (req, res) => {
				const [model, statusCode] = crudLayer.read(req.params.uuid);
				if (statusCode) {
					app.sendError(res, statusCode); return;
				}
				app.jsonResponse(res, model);
			});
		});

		// create new virtual model on database
		const [existingModel] = crudLayer.create({
			isPotatoLike: true,
			noun: 'Potat',
			color: 'red',
		});

		// build client interface
		const api = restie(apiUrl, {
			// Create the react hook plugin
			plugins: [restieSwcPlugin(useSWR, { React: require('react') })],
		});

		const { result, waitForValueToChange } = renderHook(() => api.useRestie(
			api.all('foods').all('vegetables').one(existingModel.uuid))
		);

		await waitForValueToChange(() => result.current.isValidating);
		test.assertShallowSubset(existingModel, result.current.data.result());
	});

	it('basic hook configuration (failure)', async () => {
		const [apiUrl] = await getServer((app) => {
			// define vegetable endpoint with generic id
			app.get('/foods/vegetables/:uuid', (req, res) => {
				const [model, statusCode] = crudLayer.read(req.params.uuid);
				if (statusCode) {
					app.sendError(res, statusCode); return;
				}
				app.jsonResponse(res, model);
			});
		});

		// build client interface
		const api = restie(apiUrl, {
			// Create the react hook plugin
			plugins: [restieSwcPlugin(useSWR, { React: require('react') })],
		});

		const { result, waitForValueToChange } = renderHook(() => api.useRestie(
			api.all('foods').all('vegetables').one('random'))
		);

		await waitForValueToChange(() => result.current.isValidating);
		test.assert.strictEqual(result.current.error.message, 'Not Found', 'Expected a not found error')
	});

	// create singleton server
	before(/* all tests */ () => getServer());

	// close singleton server
	after(/* all tests */ () => getServer(app => app.server.close()));
});