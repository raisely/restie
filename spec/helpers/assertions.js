// assertions.js
const assert = require('assert');

function modelHasExpectedShape(restModel) {
	const expectedKeys = ['url', 'get', 'getAll', 'post', 'patch', 'delete', 'all', 'one'];
	const modelKeys = Object.keys(restModel);
	const keysNotFound = expectedKeys.filter(key => !modelKeys.includes(key));

	assert.strictEqual(keysNotFound.length, 0, `${keysNotFound.join(',')} were expectred but missing`);
}

function modelHasExpectedPath(restModel, path) {
	assert.strictEqual(restModel.url.endsWith(path), true,
		`unexpected url generated, expected to end with "${path}", but url is "${restModel.url}"`);
}

// assert that the secondary object contains the same key-value parings as the primary 
function assertShallowSubset(primary, compareTo) {
	const compareToEntries = Object.entries(compareTo);

	Object.entries(primary).forEach(([primaryKey, primaryValue]) => {
		// check if subset object also contains the same key-value pairings
		const contains = compareToEntries.some(([subsetKey, subsetValue]) => {
			return (primaryKey === subsetKey) && (primaryValue === subsetValue);
		});

		assert.strictEqual(contains, true, `Secondary object missing key-value pairing ${primaryKey}: ${primaryValue}`);
	});
}

module.exports = {
	modelHasExpectedShape,
	modelHasExpectedPath,
	assertShallowSubset,
	assert,
}
