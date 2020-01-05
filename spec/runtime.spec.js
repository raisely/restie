const restie = require('../dist/restie');
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

	it('can add and remove request interceptors', async () => {
		const customHeaderKey = 'custom-header-x';

		// isolated flag to monitor side effect of header
		let receivedExpectedHeader = false;

		const [apiUrl] = await getServer((app) => {
			app.get('/test-intercept/request', (req, res) => {
				receivedExpectedHeader = req.headers[customHeaderKey] === 'true';
				res.end('Hey');
			});
		});

		const restApi = restie(apiUrl);

		// define custom interceptor. It's identity is based on it's own signature
		const customInterceptor = options => ({ headers: { ...options.headers, [customHeaderKey]: true } });

		// TEST: add interceptor
		restApi.addRequestInterceptor(customInterceptor);
		await restApi.one('test-intercept', 'request').get();
		test.assert.strictEqual(receivedExpectedHeader, true, 'expected custom header but was not found');

		// TEST: remove interceptor
		restApi.removeRequestInterceptor(customInterceptor);
		await restApi.one('test-intercept', 'request').get();
		test.assert.strictEqual(receivedExpectedHeader, false, 'expected no custom header but it was set');
	});

	it('can add and remove response interceptors', async () => {
		const [apiUrl] = await getServer((app) => {
			app.get('/test-intercept/response', (req, res) => res.end('Hey'));
		});

		const restApi = restie(apiUrl);

		// define custom interceptor. It's identity is based on it's own signature
		const customInterceptor = () => ({ charlie: true });

		// TEST: add interceptor
		restApi.addResponseInterceptor(customInterceptor);
		const resultWith = await restApi.one('test-intercept', 'response').get();
		test.assert.strictEqual(resultWith.charlie, true, 'expected custom response flag but none was found');

		// TEST: remove interceptor
		restApi.removeResponseInterceptor(customInterceptor);
		const resultWithout = await restApi.one('test-intercept', 'response').get();
		test.assert.strictEqual(resultWithout.charlie, undefined, 'expected no custom response flag but it was set');
	});

	it('can cache 10K requests (via default flag)', async () => {
		// use side-effect counter to help determine that we are in fact using cache
		let counter = 0;

		const [apiUrl] = await getServer((app) => {
			app.get('/test-caching/request', (req, res) => {
				res.end(`${counter++}`);
			});
		});

		// create cached model
		const cachedApiModel = restie(apiUrl, { cache: true })
			.one('test-caching', 'request');

		// make 10K async requests (RIP if caching fails)
		const requests = [];
		let totalRequests = 10000;
		while (totalRequests--) requests.push(cachedApiModel.get());
 	
 		// wait for the return values (should all be the same number)
		const results = await Promise.all(requests);
		results.forEach((r, i) => test.assert.strictEqual(r.data, '0', `the ${i + 1} request made failed caching (resolved with ${r.data})`));

		// make another request, should be a different number
		const secondResult = (await cachedApiModel.get()).data;
		test.assert.strictEqual(secondResult, '1');
	});

	// create singleton server
	before(/* all tests */ () => getServer());

	// close singleton server
	after(/* all tests */ () => getServer(app => app.server.close()));
});
