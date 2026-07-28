import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const testDirectory = fileURLToPath(new URL('../test', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../.test-dist', import.meta.url));

const entries = (await readdir(testDirectory))
	.filter((fileName) => fileName.endsWith('.test.ts'))
	.map((fileName) => `test/${fileName}`);

if (entries.length === 0) {
	throw new Error('No unit tests were found.');
}

await rm(outputDirectory, { force: true, recursive: true });

try {
	await build({
		absWorkingDir: rootDirectory,
		bundle: true,
		entryNames: '[name]',
		entryPoints: entries,
		format: 'esm',
		logLevel: 'warning',
		outExtension: { '.js': '.mjs' },
		outdir: outputDirectory,
		packages: 'external',
		platform: 'node',
		sourcemap: 'inline',
		target: 'node20',
	});

	const outputFiles = entries.map((entry) => {
		const fileName = entry.slice(entry.lastIndexOf('/') + 1).replace(/\.ts$/, '.mjs');
		return `${outputDirectory}/${fileName}`;
	});
	const exitCode = await run(process.execPath, ['--test', ...outputFiles]);

	if (exitCode !== 0) {
		process.exitCode = exitCode;
	}
} finally {
	await rm(outputDirectory, { force: true, recursive: true });
}

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'inherit' });
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (signal !== null) {
				reject(new Error(`Test process exited due to ${signal}.`));
				return;
			}
			resolve(code ?? 1);
		});
	});
}
