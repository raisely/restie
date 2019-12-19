// fakeDB.js
const uuid = require('uuid/v4');

module.exports = function fakeDB() {
	const fakeTable = new Map();

	const crudLayer = {
		create(data) {
			const key = uuid();
			const model = {
				...data,
				uuid: key,
			};

			fakeTable.set(key, model);
			return [model, null];
		},
		read(key) {
			const model = fakeTable.get(key);

			if (!model) return [null, 404];

			return [model, null]
		},
		update(key, newData) {
			const model = fakeTable.get(key);

			if (!model) return [null, 404];

			// cheap update via merge (not real op)
			const newModel = {
				...model,
				...(newData || {}),
			};

			// update DB model
			fakeTable.set(key, newModel)
			return [newModel, null];
		},
		destory(key) {
			const model = fakeTable.get(key);

			if (!model) return [null, 404];

			// remove model from DB
			fakeTable.delete(key);

			return [{ deleted: true }, null];
		}
	};

	return [fakeTable, crudLayer];
}
