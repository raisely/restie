const restie = require('../dist/restcore');
const test = require('./helpers/assertions');
const getServer = require('./helpers/testServer')();

global.fetch = require('node-fetch');

describe('runtime', () => {
	it('will fallback to plaintext as needed', async () => {
		const message = 'This is non JSON';

		const [apiUrl] = await getServer((app) => {
			app.get('/send/missingno', (req, res) => {
				// don't include content-type
				res.writeHead(200);
				res.end(message);
			});
		});

		const result = await restie(apiUrl).all('send/missingno').get();
		test.assert.strictEqual(result.data, message);
	});

	it('handles status codes as expected', async () => {
		const [apiUrl] = await getServer((app) => {
			app.get('/statustest/:status', (req, res) => {
				res.statusCode = parseInt(req.params.status);
				res.end('Hey');
			});
		});

		const tests = [
			{ lower: 200, upper: 299, shouldThrow: false },
			{ lower: 300, upper: 599, shouldThrow: true }
		];

		const restApi = restie(apiUrl).all('statustest');

		for (const { lower, upper, shouldThrow } of tests) {
			for (let code = lower; code <= upper; code++) {
				let evadedThrow = false;

				try {
					await restApi.one(code).get();

					if (shouldThrow) {
						// flag avoided throw
						evadedThrow = true;
					}

				} catch (error) {
					if (!shouldThrow) {
						console.error(error);
						throw new Error(`Error thrown with status ${code}`);
					}
				}

				if (evadedThrow) {
					throw new Error(`Expected error to be thrown with status ${code}, but none was thrown`);
				}
			}
		}
	});

	// create singleton server
	before(/* all tests */ () => getServer());

	// close singleton server
	after(/* all tests */ () => getServer(app => app.server.close()));
});
