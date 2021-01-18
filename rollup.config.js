// detect environmental settings
const avoidBabel = process.env.NO_BABEL === 'true';
const avoidMinify = process.env.NO_MINIFY === 'true';

function determineDestFileFromEnv() {
	// output filename that's joined by dot-names
	const fileParts = ['dist/restie'];

	if (!avoidBabel) {
		fileParts.push('dist');
	}

	if (!avoidMinify) {
		fileParts.push('min');
	}

	// add extension
	fileParts.push('js');

	return fileParts.join('.');
}

function determinePluginsFromEnv() {
	// define plugins dynamically
	const plugins = [];

	if (!avoidBabel) {
		const babel = require('rollup-plugin-babel');

		plugins.push(
			babel({
				exclude: 'node_modules/**',
				// babelrc: false,
			})
		);
	}

	if (!avoidMinify) {
		const { terser } = require('rollup-plugin-terser');

		plugins.push(
			terser({
				mangle: true,
			})
		);
	}

	return plugins;
}

// configuration file
module.exports = {
	input: 'src/restie.js',
	output: {
		file: determineDestFileFromEnv(),
		format: 'cjs',
		sourcemap: !avoidMinify,
	},
	plugins: determinePluginsFromEnv(),
}
