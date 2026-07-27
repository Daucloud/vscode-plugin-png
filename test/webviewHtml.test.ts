import assert from 'node:assert/strict';
import test from 'node:test';
import { getWebviewHtml } from '../src/webviewHtml';

void test('webview HTML enforces a nonce-based content security policy', () => {
	const html = getWebviewHtml({
		cspSource: 'https://resource.example',
		nonce: 'test-nonce',
		scriptUri: 'https://resource.example/webview.js',
		styleUri: 'https://resource.example/image-viewer.css',
	});

	assert.match(html, /default-src 'none'/);
	assert.match(html, /script-src 'nonce-test-nonce'/);
	assert.match(html, /nonce="test-nonce"/);
	assert.doesNotMatch(html, /unsafe-inline/);
});

void test('webview resource attributes are escaped', () => {
	const html = getWebviewHtml({
		cspSource: 'https://resource.example',
		nonce: 'nonce',
		scriptUri: 'https://resource.example/script.js?value="unsafe"&next=1',
		styleUri: 'https://resource.example/style.css',
	});

	assert.match(html, /value=&quot;unsafe&quot;&amp;next=1/);
	assert.doesNotMatch(html, /value="unsafe"/);
});
