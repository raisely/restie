module.exports = {
	presets: [
		['@babel/env', {
			targets: {
				browsers: ['>0.25%', 'not ie 10', 'not op_mini all'],
			},
			modules: false
		}]
	],
	plugins: [
		'babel-plugin-transform-async-to-promises'
	],
}