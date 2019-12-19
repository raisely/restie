const restie = require('../dist/restcore');
const test = require('./helpers/assertions');
const getServer = require('./helpers/testServer')();
const fakeDB = require('./helpers/fakeDB');

global.fetch = require('node-fetch');

describe('e2e', () => {
	const [fakeTable, crudLayer] = fakeDB();

	it('can create a remote model', async () => {
		const [apiUrl] = await getServer((app) => {
			app.post('/boxes/current/crayons', (req, res) => {
				// create persistant instance in fake key-value store
				const [model] = crudLayer.create(req.body);
				app.jsonResponse(res, model);
			});
		});
		
		// build client interface
		const crayons = restie(apiUrl)
			.one('boxes', 'current')
			.all('crayons');

		const shape = {
			color: 'red',
			size: 'small',
		};

		const response = await crayons.post(shape);

		// ensure that all values in payload were returned
		test.assertShallowSubset(shape, response.data);
		// ensure that response matches stored model exactly
		test.assertShallowSubset(response.data, fakeTable.get(response.data.uuid));
	});

	it('can read model from remote', async () => {
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
		const vegetables = restie(apiUrl)
			.all('foods')
			.all('vegetables');

		// get specific vegetable from server
		const response = await vegetables.get(existingModel.uuid);

		// ensure that all values in payload were returned
		test.assertShallowSubset(existingModel, response.data);
	});

	it('can update model on remote', async () => {
		const [apiUrl] = await getServer((app) => {
			// define vegetable endpoint with generic id
			app.put('/planets/earth/humans/:uuid', (req, res) => {
				const [model, statusCode] = crudLayer.update(req.params.uuid, req.body);

				if (statusCode) {
					app.sendError(res, statusCode); return;
				}

				app.jsonResponse(res, model);
			});
		});

		const baseShape = {
			fullName: 'Hubert J. Farnsworth',
			homeworld: 'earth',
		};

		const [existingModel] = crudLayer.create({
			...baseShape,
			enjoymentOnHomeworld: true,
		});

		// get interface specifc human on earth
		const farnsworth = restie(apiUrl)
			.one('planets', 'earth')
			.one('humans', existingModel.uuid);

		const updatedFarnsworth = await farnsworth.put({ enjoymentOnHomeworld: false });

		// ensure change in model is reflected in response
		test.assertShallowSubset({
			...baseShape,
			enjoymentOnHomeworld: false,
		}, updatedFarnsworth.data);
	});

	it('can destroy model on remote', async () => {
		const [apiUrl] = await getServer((app) => {
			// define vegetable endpoint with generic id
			app.delete('/warehouse/1/boxes/:uuid', (req, res) => {
				const [result, statusCode] = crudLayer.destory(req.params.uuid);

				if (statusCode) {
					app.sendError(res, statusCode); return;
				}

				app.jsonResponse(res, result);
			});
		});

		// create new virtual model on database
		const [existingModel] = crudLayer.create({
			size: 'large',
			color: 'brown',
		});

		const { uuid: boxUuid } = existingModel;

		const brownBox = restie(apiUrl)
			.one('warehouse', 1)
			.one('boxes', boxUuid);

		// delete box
		const deleteResult = await brownBox.delete();
		
		test.assertShallowSubset({ deleted: true }, deleteResult.data);
		test.assert.strictEqual(fakeTable.has(boxUuid), false, 'Model still present in fakeDB');
	});

	// create singleton server
	before(/* all tests */ () => getServer());

	// close singleton server
	after(/* all tests */ () => getServer(app => app.server.close()));
});
