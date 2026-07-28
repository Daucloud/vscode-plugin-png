export const MIN_SCALE = 0.05;
export const MAX_SCALE = 32;

export type BackgroundMode = 'white' | 'checkerboard' | 'editor';
export type BackgroundPreference = 'auto' | BackgroundMode;
export type ZoomMode = 'fitWidth' | 'fit' | 'actualSize';

const BACKGROUND_MODES: readonly BackgroundMode[] = [
	'white',
	'checkerboard',
	'editor',
];

export function clampScale(scale: number): number {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function getInitialScale(
	mode: ZoomMode,
	imageWidth: number,
	imageHeight: number,
	viewportWidth: number,
	viewportHeight: number,
	padding = 48,
): number {
	if (
		!isPositiveFinite(imageWidth)
		|| !isPositiveFinite(imageHeight)
		|| !isPositiveFinite(viewportWidth)
		|| !isPositiveFinite(viewportHeight)
	) {
		return 1;
	}

	const availableWidth = Math.max(1, viewportWidth - (padding * 2));
	const availableHeight = Math.max(1, viewportHeight - (padding * 2));
	const widthScale = availableWidth / imageWidth;
	const heightScale = availableHeight / imageHeight;

	switch (mode) {
		case 'actualSize':
			return 1;
		case 'fit':
			return clampScale(Math.min(1, widthScale, heightScale));
		case 'fitWidth':
			return clampScale(Math.min(1, widthScale));
	}
}

export function resolveBackground(
	preference: BackgroundPreference,
	themeKind: number,
): BackgroundMode {
	if (preference !== 'auto') {
		return preference;
	}

	// VS Code ThemeKind.Dark = 2 and ThemeKind.HighContrast = 3.
	return themeKind === 2 || themeKind === 3 ? 'white' : 'checkerboard';
}

export function getNextBackground(current: BackgroundMode): BackgroundMode {
	const currentIndex = BACKGROUND_MODES.indexOf(current);
	return BACKGROUND_MODES[(currentIndex + 1) % BACKGROUND_MODES.length] ?? 'white';
}

export function getBackgroundLabel(mode: BackgroundMode): string {
	switch (mode) {
		case 'white':
			return 'White';
		case 'checkerboard':
			return 'Checkerboard';
		case 'editor':
			return 'Editor';
	}
}

export function getAnchoredScroll(
	scrollPosition: number,
	anchorPosition: number,
	oldExtent: number,
	newExtent: number,
	viewportExtent: number,
): number {
	if (oldExtent <= 0 || newExtent <= viewportExtent) {
		return 0;
	}

	const anchorRatio = (scrollPosition + anchorPosition) / oldExtent;
	const desiredPosition = (anchorRatio * newExtent) - anchorPosition;
	const maximumPosition = Math.max(0, newExtent - viewportExtent);
	return Math.min(maximumPosition, Math.max(0, desiredPosition));
}

export function normalizeWheelDelta(
	delta: number,
	deltaMode: number,
	pageSize: number,
): number {
	switch (deltaMode) {
		case 1:
			return delta * 16;
		case 2:
			return delta * pageSize;
		default:
			return delta;
	}
}

function isPositiveFinite(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}
