const restie = require('../dist/restie');
const test = require('./helpers/assertions');
const getServer = require('./helpers/testServer')();

const {
	sendRequestWave,
	pause,
	getBatchResults,
} = require('./helpers/misc');

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
 		// wait for the return values (should all be the same number)
		const results = getBatchResults(await sendRequestWave(cachedApiModel, 10000));
		test.allEqual(results, '0',
			(value, index) => `the ${index + 1} request made failed caching (resolved with ${value})`)

		// make another request, should be a different number
		test.assert.strictEqual((await cachedApiModel.get()).result(), '1');
	});

	// it('can cache 10K requests (5K -0, 5K -1) (TTL mode)', async function () {
	// 	this.timeout(5000);
	//
	// 	// use side-effect counter to help determine that we are in fact using cache
	// 	let counter = 0;
	//
	// 	const [apiUrl] = await getServer((app) => {
	// 		app.get('/test-caching/request', (req, res) => {
	// 			res.end(`${counter++}`);
	// 		});
	// 	});
	//
	// 	// create cached model
	// 	const cachedApiModel = restie(apiUrl, {
	// 		cache: true,
	// 		cacheTtl: 1000,
	// 	}).one('test-caching', 'request');
	//
	// 	// The first two batches should be performed in sequence to make sure that the Ttl isn't expiring unexpectedly
	// 	const first = getBatchResults(await sendRequestWave(cachedApiModel, 2500));
	// 	await pause(900);
	// 	const second = getBatchResults(await sendRequestWave(cachedApiModel, 2500));
	//
	// 	// Wait for TTL to expire
	// 	await pause(1100);
	//
	// 	const third = getBatchResults(await sendRequestWave(cachedApiModel, 2500));
	// 	await pause(900);
	// 	const forth = getBatchResults(await sendRequestWave(cachedApiModel, 2500));
	//
	// 	// Ensure that batches are caching separately, but also grouped by TTL timeout
	// 	test.allEqual([...first, ...second], '0',
	// 		(value, index) => `the ${index + 1} request made failed caching (resolved with ${value})`)
	// 	test.allEqual([...third, ...forth], '1',
	// 		(value, index) => `the ${index + 1} request made failed caching (resolved with ${value})`)
	// });

	it('can rate limit batches (10 bucket size @ 500 requests)', async function () {
		this.timeout(5000);

		// track the toal number of batches
		let totalBatches = 0;

		// use side-effect counter to help determine that we are in fact using cache
		const [apiUrl] = await getServer((app) => {
			// create placeholder to test that bucket
			let createNewSetTimeout = null;

			app.get('/test-caching/request', (req, res) => {
				// Use a simple timeout technique to detect a batch reaching the api
				if (createNewSetTimeout) clearTimeout(createNewSetTimeout);
				createNewSetTimeout = setTimeout(() => totalBatches++, 10);

				// Give each request a life span of around 80ms
				setTimeout(() => res.end(`done`), 80);
			});
		});

		// create cached model
		const cachedApiModel = restie(apiUrl, {
			bucketSize: 10,
		}).one('test-caching', 'request');

		// The first two batches should be performed in sequence to make sure that the Ttl isn't expiring unexpectedly
		await sendRequestWave(cachedApiModel, 500);
		test.assert.strictEqual(totalBatches, 50, `Expected exactly 50 batches to be reported by the api, instead got ${totalBatches}`);
	});

	// create singleton server
	before(/* all tests */ () => getServer());

	// close singleton server
	after(/* all tests */ () => getServer(app => app.server.close()));
});

