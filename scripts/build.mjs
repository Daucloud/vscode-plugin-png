import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../dist', import.meta.url));
const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');
const cleanOnly = process.argv.includes('--clean');

await rm(outputDirectory, { force: true, recursive: true });

if (cleanOnly) {
	process.exit(0);
}

const sharedOptions = {
	absWorkingDir: rootDirectory,
	bundle: true,
	legalComments: 'none',
	logLevel: 'info',
	minify: isProduction,
	sourcemap: isProduction ? false : 'linked',
};

const buildOptions = [
	{
		...sharedOptions,
		entryPoints: ['src/extension.ts'],
		external: ['vscode'],
		format: 'cjs',
		outfile: 'dist/extension.js',
		platform: 'node',
		target: 'node20',
	},
	{
		...sharedOptions,
		entryPoints: ['src/webview/main.ts'],
		format: 'iife',
		outfile: 'dist/webview.js',
		platform: 'browser',
		target: 'chrome120',
	},
];

if (isWatch) {
	const contexts = await Promise.all(buildOptions.map((options) => context(options)));
	await Promise.all(contexts.map((buildContext) => buildContext.watch()));
	console.log('Watching extension and webview sources…');

	const dispose = async () => {
		await Promise.all(contexts.map((buildContext) => buildContext.dispose()));
		process.exit(0);
	};

	process.once('SIGINT', () => {
		void dispose();
	});
	process.once('SIGTERM', () => {
		void dispose();
	});
} else {
	await Promise.all(buildOptions.map((options) => build(options)));
}
