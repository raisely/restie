// testServer.js
const polka = require('polka');
const cors = require('cors');
const { json } = require('body-parser');

const buildTestServer = (config) => new Promise((resolve) => {
	const instance = polka(config)
		.use(cors(), json())
		// rely on Node.js automatic port detection
		// noice way to prevent conflicts cross-platform
		.listen(undefined, () => {
			// get the autoserive -assigned port
			const { port } = instance.server.address();

			instance.jsonResponse = (res, payload, status = 200) => {
				res.writeHead(status, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(payload));
			}

			instance.sendError = (res, statusCode, errorMessage = null) => {
				res.statusCode = statusCode;
				res.end(errorMessage || `Error ${statusCode}`);
			}

			resolve([`http://0.0.0.0:${port}`, scope => scope(instance)]);
		});
});

// singleton factory for test server
function serverInstanceSingleton(config) {
	let existingInstance = null;

	return async function getServer(action = null) {
		const instance = existingInstance || (await buildTestServer(config));

		if (!existingInstance) {
			// eslint-disable-next-line require-atomic-updates
			existingInstance = instance;
		}

		// peform any inline actions
		if (typeof action === 'function') {
			instance[1](action);
		}

		return instance;
	}
}

module.exports = serverInstanceSingleton;
