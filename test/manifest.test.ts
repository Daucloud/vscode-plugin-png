import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

interface ExtensionManifest {
	readonly main: string;
	readonly dependencies?: Record<string, string>;
	readonly contributes: {
		readonly commands: readonly { readonly command: string }[];
		readonly keybindings: readonly { readonly command: string; readonly when: string }[];
	};
}

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as ExtensionManifest;

void test('manifest points at the bundled extension and has no runtime dependencies', () => {
	assert.equal(manifest.main, './dist/extension.js');
	assert.deepEqual(manifest.dependencies, undefined);
});

void test('issue-related viewer commands are contributed and scoped to the custom editor', () => {
	const commands = new Set(manifest.contributes.commands.map(({ command }) => command));
	assert.ok(commands.has('darkThemeImageView.copyImage'));
	assert.ok(commands.has('darkThemeImageView.toggleBackground'));

	for (const keybinding of manifest.contributes.keybindings) {
		assert.equal(keybinding.when, 'activeCustomEditorId == darkThemeImageViewEditor');
	}
});
