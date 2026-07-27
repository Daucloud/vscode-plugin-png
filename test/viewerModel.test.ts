import assert from 'node:assert/strict';
import test from 'node:test';
import {
	clampScale,
	getAnchoredScroll,
	getInitialScale,
	getNextBackground,
	normalizeWheelDelta,
	resolveBackground,
} from '../src/viewerModel';

void test('fit-width keeps a tall image scrollable', () => {
	assert.equal(getInitialScale('fitWidth', 800, 8_000, 1_000, 700), 1);
	assert.equal(getInitialScale('fitWidth', 2_000, 8_000, 1_000, 700), 0.452);
});

void test('fit mode constrains both image dimensions', () => {
	assert.equal(getInitialScale('fit', 800, 8_000, 1_000, 700), 0.0755);
	assert.equal(getInitialScale('actualSize', 8_000, 8_000, 500, 500), 1);
});

void test('scale is clamped to safe viewer bounds', () => {
	assert.equal(clampScale(0), 0.05);
	assert.equal(clampScale(1.5), 1.5);
	assert.equal(clampScale(100), 32);
});

void test('automatic backgrounds follow VS Code theme kinds', () => {
	assert.equal(resolveBackground('auto', 1), 'checkerboard');
	assert.equal(resolveBackground('auto', 2), 'white');
	assert.equal(resolveBackground('auto', 3), 'white');
	assert.equal(resolveBackground('auto', 4), 'checkerboard');
	assert.equal(resolveBackground('editor', 2), 'editor');
});

void test('background shortcut cycles through every mode', () => {
	assert.equal(getNextBackground('white'), 'checkerboard');
	assert.equal(getNextBackground('checkerboard'), 'editor');
	assert.equal(getNextBackground('editor'), 'white');
});

void test('zoom anchoring preserves the point below the cursor', () => {
	assert.equal(getAnchoredScroll(100, 200, 1_000, 2_000, 500), 400);
	assert.equal(getAnchoredScroll(0, 200, 500, 300, 500), 0);
});

void test('wheel deltas normalize pixels, lines, and pages', () => {
	assert.equal(normalizeWheelDelta(4, 0, 600), 4);
	assert.equal(normalizeWheelDelta(4, 1, 600), 64);
	assert.equal(normalizeWheelDelta(1, 2, 600), 600);
});
