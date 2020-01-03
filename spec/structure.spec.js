// core.spec.js

const test = require('./helpers/assertions');
const restcore = require('../dist/restie');

// tests happen without touching test server so this can be anything
const getTestServerBaseUrl = () => `http://0.0.0.0:3000`;

describe('structure', () => {
	it('models initialize (as nested pathways)', () => {
		const api = restcore(getTestServerBaseUrl());

		// direct sub-class (all children in households)
		const household = api
			.all('households')

		test.modelHasExpectedShape(household);
		test.modelHasExpectedPath(household, '/households');

		// direct sub-class owned by class (all children in specific household)
		const specifcHouseholdsChildren = household
			.one(123456)
			.all('children');

		test.modelHasExpectedShape(specifcHouseholdsChildren);
		test.modelHasExpectedPath(specifcHouseholdsChildren, '/households/123456/children');

		// specific sub-class owned by parent (all toys owned by specific child in specific household)
		const childrensToysOwnedByChild = specifcHouseholdsChildren
			.one('sam')
			.all('toys');

		test.modelHasExpectedShape(childrensToysOwnedByChild);
		test.modelHasExpectedPath(childrensToysOwnedByChild, '/households/123456/children/sam/toys');
	});

	it('can traverse up complex model parent tree', () => {
		const api = restcore(getTestServerBaseUrl());

		/**
		 * All of the bananas belonging to the monkey identified as andy
		 * that's within the scope of planet earth, which is in the solar system
		 * named home
		 */
		const allBannanasBelongingToAndy = api
			.one('solar-systems', 'home')
			.one('planets', 'earth')
			.all('monkeys')
			.one('andy')
			.all('bananas');

		// define expected parents
		const expectedParentUrls = [
			'/solar-systems/home/planets/earth/monkeys/andy',
			'/solar-systems/home/planets/earth/monkeys',
			'/solar-systems/home/planets/earth',
			'/solar-systems/home/planets',
			'/solar-systems/home',
			'/solar-systems',
		];

		let currentParent = allBannanasBelongingToAndy.parent();

		while (currentParent) {
			// get the expected url
			const expectedUrl = expectedParentUrls.shift();

			// check to see it has the expected path
			test.modelHasExpectedPath(currentParent, expectedUrl);
			test.modelHasExpectedShape(currentParent);

			// go up
			currentParent = currentParent.parent();
		}
	});
});
