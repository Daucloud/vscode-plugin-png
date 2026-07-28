import {
	clampScale,
	getAnchoredScroll,
	getBackgroundLabel,
	getInitialScale,
	getNextBackground,
	normalizeWheelDelta,
	resolveBackground,
} from '../viewerModel';
import type {
	BackgroundMode,
	BackgroundPreference,
	ZoomMode,
} from '../viewerModel';

declare function acquireVsCodeApi<TState>(): VsCodeApi<TState>;

interface VsCodeApi<TState> {
	getState(): TState | undefined;
	postMessage(message: unknown): void;
	setState(state: TState): void;
}

type ViewerCommand =
	| 'actualSize'
	| 'copy'
	| 'fitWidth'
	| 'toggleBackground'
	| 'zoomIn'
	| 'zoomOut';

type HostMessage =
	| {
		type: 'command';
		command: ViewerCommand;
	}
	| {
		type: 'environment';
		themeKind: number;
		defaultBackground: BackgroundPreference;
		defaultZoom: ZoomMode;
	}
	| {
		type: 'imageUnavailable';
		message: string;
	}
	| {
		type: 'loadImage';
		documentKey: string;
		source: string;
		themeKind: number;
		defaultBackground: BackgroundPreference;
		defaultZoom: ZoomMode;
	};

interface PersistedState {
	readonly version: number;
	readonly documentKey: string;
	readonly scale: number;
	readonly backgroundMode: BackgroundMode;
	readonly backgroundCustomized: boolean;
	readonly scrollLeft: number;
	readonly scrollTop: number;
}

interface Environment {
	themeKind: number;
	defaultBackground: BackgroundPreference;
	defaultZoom: ZoomMode;
}

interface DragState {
	readonly pointerId: number;
	lastX: number;
	lastY: number;
}

const vscode = acquireVsCodeApi<PersistedState>();
const viewport = getElement<HTMLElement>('viewport');
const stage = getElement<HTMLElement>('stage');
const imageSurface = getElement<HTMLElement>('image-surface');
const image = getElement<HTMLImageElement>('image');
const message = getElement<HTMLElement>('message');
const metadata = getElement<HTMLElement>('metadata');
const toast = getElement<HTMLElement>('toast');
const zoomStatus = getElement<HTMLButtonElement>('zoom-status');
const backgroundButton = getElement<HTMLButtonElement>('background-button');

const stagePadding = 48;
let environment: Environment = {
	defaultBackground: 'auto',
	defaultZoom: 'fitWidth',
	themeKind: 1,
};
let documentKey = '';
let backgroundMode: BackgroundMode = 'editor';
let backgroundCustomized = false;
let scale = 1;
let naturalWidth = 0;
let naturalHeight = 0;
let imageLoaded = false;
let loadSequence = 0;
let copyInProgress = false;
let dragState: DragState | undefined;
let toastTimer: number | undefined;
let persistFrame: number | undefined;

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-viewer-command]')) {
	const command = button.dataset.viewerCommand;
	if (isViewerCommand(command)) {
		button.addEventListener('click', () => {
			void executeCommand(command);
		});
	}
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
	const hostMessage = parseHostMessage(event.data);
	if (hostMessage === undefined) {
		return;
	}

	switch (hostMessage.type) {
		case 'command':
			void executeCommand(hostMessage.command);
			break;
		case 'environment':
			updateEnvironment(hostMessage);
			break;
		case 'imageUnavailable':
			imageLoaded = false;
			imageSurface.hidden = true;
			showMessage(hostMessage.message);
			break;
		case 'loadImage':
			updateEnvironment(hostMessage);
			loadImage(hostMessage);
			break;
	}
});

viewport.addEventListener('wheel', (event) => {
	const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, viewport.clientHeight);
	const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, viewport.clientWidth);

	if (event.ctrlKey || event.metaKey) {
		event.preventDefault();
		const bounds = viewport.getBoundingClientRect();
		const factor = Math.exp(-deltaY * 0.0015);
		setScale(scale * factor, {
			x: event.clientX - bounds.left,
			y: event.clientY - bounds.top,
		});
		return;
	}

	if (event.shiftKey) {
		const horizontalDelta = Math.abs(deltaX) > 0 ? deltaX : deltaY;
		if (horizontalDelta !== 0 && viewport.scrollWidth > viewport.clientWidth) {
			const previousScrollLeft = viewport.scrollLeft;
			viewport.scrollLeft += horizontalDelta;
			if (viewport.scrollLeft !== previousScrollLeft) {
				event.preventDefault();
			}
		}
	}
}, { passive: false });

image.addEventListener('pointerdown', (event) => {
	if (event.button !== 0 || !imageLoaded) {
		return;
	}

	dragState = {
		lastX: event.clientX,
		lastY: event.clientY,
		pointerId: event.pointerId,
	};
	image.setPointerCapture(event.pointerId);
	image.classList.add('dragging');
	viewport.focus({ preventScroll: true });
	event.preventDefault();
});

image.addEventListener('pointermove', (event) => {
	if (dragState?.pointerId !== event.pointerId) {
		return;
	}

	viewport.scrollLeft -= event.clientX - dragState.lastX;
	viewport.scrollTop -= event.clientY - dragState.lastY;
	dragState.lastX = event.clientX;
	dragState.lastY = event.clientY;
});

const stopDragging = (event: PointerEvent) => {
	if (dragState?.pointerId !== event.pointerId) {
		return;
	}

	if (image.hasPointerCapture(event.pointerId)) {
		image.releasePointerCapture(event.pointerId);
	}
	dragState = undefined;
	image.classList.remove('dragging');
};

image.addEventListener('pointerup', stopDragging);
image.addEventListener('pointercancel', stopDragging);
image.addEventListener('lostpointercapture', () => {
	dragState = undefined;
	image.classList.remove('dragging');
});

document.addEventListener('keydown', (event) => {
	const target = event.target;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
		return;
	}

	const modifier = event.ctrlKey || event.metaKey;
	if (modifier) {
		let command: ViewerCommand | undefined;
		switch (event.key.toLowerCase()) {
			case 'c':
				command = 'copy';
				break;
			case '+':
			case '=':
				command = 'zoomIn';
				break;
			case '-':
				command = 'zoomOut';
				break;
			case '0':
				command = 'fitWidth';
				break;
			case '1':
				command = 'actualSize';
				break;
		}

		if (command !== undefined) {
			event.preventDefault();
			void executeCommand(command);
		}
		return;
	}

	if (event.key.toLowerCase() === 'b') {
		event.preventDefault();
		void executeCommand('toggleBackground');
	}
});

viewport.addEventListener('scroll', schedulePersist);

if ('ResizeObserver' in window) {
	const resizeObserver = new ResizeObserver(() => {
		if (imageLoaded) {
			updateGeometry();
		}
	});
	resizeObserver.observe(viewport);
}

vscode.postMessage({ type: 'ready' });

function loadImage(hostMessage: Extract<HostMessage, { type: 'loadImage' }>): void {
	const sequence = ++loadSequence;
	documentKey = hostMessage.documentKey;
	imageLoaded = false;
	imageSurface.hidden = true;
	showMessage('Loading image…');
	updateMetadata();

	const savedState = getSavedState(hostMessage.documentKey);
	backgroundCustomized = savedState?.backgroundCustomized ?? false;
	backgroundMode = backgroundCustomized
		? (savedState?.backgroundMode ?? resolveBackground(hostMessage.defaultBackground, hostMessage.themeKind))
		: resolveBackground(hostMessage.defaultBackground, hostMessage.themeKind);
	applyBackground();

	image.onload = () => {
		if (sequence !== loadSequence) {
			return;
		}

		naturalWidth = image.naturalWidth || image.width;
		naturalHeight = image.naturalHeight || image.height;
		if (naturalWidth <= 0 || naturalHeight <= 0) {
			showMessage('The image has no displayable dimensions.');
			return;
		}

		imageLoaded = true;
		scale = savedState === undefined
			? getInitialScale(
				hostMessage.defaultZoom,
				naturalWidth,
				naturalHeight,
				viewport.clientWidth,
				viewport.clientHeight,
				stagePadding,
			)
			: clampScale(savedState.scale);
		showMessage('');
		updateGeometry();

		if (savedState !== undefined) {
			viewport.scrollLeft = savedState.scrollLeft;
			viewport.scrollTop = savedState.scrollTop;
		} else {
			viewport.scrollLeft = Math.max(0, (stage.offsetWidth - viewport.clientWidth) / 2);
			viewport.scrollTop = 0;
		}
		schedulePersist();
	};

	image.onerror = () => {
		if (sequence !== loadSequence) {
			return;
		}
		imageLoaded = false;
		imageSurface.hidden = true;
		showMessage('Unable to load this image.');
		vscode.postMessage({ type: 'loadError', message: 'Unable to load the image.' });
	};

	image.src = hostMessage.source;
}

function updateEnvironment(nextEnvironment: {
	themeKind: number;
	defaultBackground: BackgroundPreference;
	defaultZoom: ZoomMode;
}): void {
	environment = {
		defaultBackground: nextEnvironment.defaultBackground,
		defaultZoom: nextEnvironment.defaultZoom,
		themeKind: nextEnvironment.themeKind,
	};

	if (!backgroundCustomized) {
		backgroundMode = resolveBackground(environment.defaultBackground, environment.themeKind);
		applyBackground();
	}
}

async function executeCommand(command: ViewerCommand): Promise<void> {
	switch (command) {
		case 'actualSize':
			setScale(1, getViewportCenter());
			break;
		case 'copy':
			await copyImage();
			break;
		case 'fitWidth':
			fitWidth();
			break;
		case 'toggleBackground':
			backgroundMode = getNextBackground(backgroundMode);
			backgroundCustomized = true;
			applyBackground();
			schedulePersist();
			showToast(`${getBackgroundLabel(backgroundMode)} background`);
			break;
		case 'zoomIn':
			setScale(scale * 1.15, getViewportCenter());
			break;
		case 'zoomOut':
			setScale(scale / 1.15, getViewportCenter());
			break;
	}
}

function fitWidth(): void {
	if (!imageLoaded) {
		return;
	}

	const nextScale = getInitialScale(
		'fitWidth',
		naturalWidth,
		naturalHeight,
		viewport.clientWidth,
		viewport.clientHeight,
		stagePadding,
	);
	setScale(nextScale, getViewportCenter());
}

function setScale(nextScale: number, anchor?: { readonly x: number; readonly y: number }): void {
	if (!imageLoaded) {
		return;
	}

	const oldWidth = stage.offsetWidth;
	const oldHeight = stage.offsetHeight;
	const oldScrollLeft = viewport.scrollLeft;
	const oldScrollTop = viewport.scrollTop;
	scale = clampScale(nextScale);
	updateGeometry();

	if (anchor !== undefined) {
		viewport.scrollLeft = getAnchoredScroll(
			oldScrollLeft,
			anchor.x,
			oldWidth,
			stage.offsetWidth,
			viewport.clientWidth,
		);
		viewport.scrollTop = getAnchoredScroll(
			oldScrollTop,
			anchor.y,
			oldHeight,
			stage.offsetHeight,
			viewport.clientHeight,
		);
	}
	schedulePersist();
}

function updateGeometry(): void {
	if (!imageLoaded) {
		return;
	}

	const displayWidth = Math.max(1, naturalWidth * scale);
	const displayHeight = Math.max(1, naturalHeight * scale);
	stage.style.width = `${Math.max(viewport.clientWidth, displayWidth + (stagePadding * 2))}px`;
	stage.style.height = `${Math.max(viewport.clientHeight, displayHeight + (stagePadding * 2))}px`;
	imageSurface.style.width = `${displayWidth}px`;
	imageSurface.style.height = `${displayHeight}px`;
	imageSurface.hidden = false;
	updateMetadata();
}

function applyBackground(): void {
	imageSurface.className = `background-${backgroundMode}`;
	backgroundButton.textContent = `Background: ${getBackgroundLabel(backgroundMode)}`;
	backgroundButton.title = `Cycle background (B), currently ${getBackgroundLabel(backgroundMode)}`;
	updateMetadata();
}

function updateMetadata(): void {
	if (!imageLoaded) {
		metadata.textContent = '';
		zoomStatus.textContent = '—';
		return;
	}

	metadata.textContent = `${naturalWidth} × ${naturalHeight} · ${Math.round(scale * 100)}% · ${getBackgroundLabel(backgroundMode)}`;
	zoomStatus.textContent = `${Math.round(scale * 100)}%`;
}

async function copyImage(): Promise<void> {
	if (!imageLoaded || copyInProgress) {
		if (!imageLoaded) {
			showToast('The image is still loading.');
		}
		return;
	}

	copyInProgress = true;
	try {
		const blob = await renderClipboardImage();
		const clipboard = (navigator as Partial<Navigator>).clipboard;
		if (typeof ClipboardItem === 'undefined' || clipboard === undefined || typeof clipboard.write !== 'function') {
			throw new Error('This VS Code version does not expose image clipboard support.');
		}
		await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		showToast('Image copied to clipboard');
		vscode.postMessage({ type: 'copySucceeded' });
	} catch (error) {
		const detail = error instanceof Error ? error.message : 'Clipboard access was denied.';
		showToast('Could not copy the image. Check clipboard permissions.');
		vscode.postMessage({ type: 'copyError', message: detail });
	} finally {
		copyInProgress = false;
	}
}

/*
 * The canvas is created only for the clipboard operation. Keeping the on-screen
 * surface as an <img> avoids allocating a second full-size pixel buffer for
 * every open document.
 */
async function renderClipboardImage(): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = naturalWidth;
	canvas.height = naturalHeight;
	try {
		const context = canvas.getContext('2d');
		if (context === null) {
			throw new Error('A 2D canvas context is unavailable.');
		}

		if (backgroundMode === 'white') {
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, naturalWidth, naturalHeight);
		}
		context.drawImage(image, 0, 0, naturalWidth, naturalHeight);
		return await canvasToBlob(canvas);
	} finally {
		canvas.width = 1;
		canvas.height = 1;
	}
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob === null) {
				reject(new Error('The image could not be encoded as PNG.'));
				return;
			}
			resolve(blob);
		}, 'image/png');
	});
}

function getViewportCenter(): { readonly x: number; readonly y: number } {
	return {
		x: viewport.clientWidth / 2,
		y: viewport.clientHeight / 2,
	};
}

function getSavedState(key: string): PersistedState | undefined {
	const candidate = vscode.getState();
	if (
		candidate === undefined
		|| candidate.version !== 1
		|| candidate.documentKey !== key
		|| !Number.isFinite(candidate.scale)
		|| !Number.isFinite(candidate.scrollLeft)
		|| !Number.isFinite(candidate.scrollTop)
		|| !isBackgroundMode(candidate.backgroundMode)
	) {
		return undefined;
	}
	return candidate;
}

function schedulePersist(): void {
	if (persistFrame !== undefined) {
		return;
	}
	persistFrame = window.requestAnimationFrame(() => {
		persistFrame = undefined;
		if (!imageLoaded || documentKey.length === 0) {
			return;
		}
		vscode.setState({
			backgroundCustomized,
			backgroundMode,
			documentKey,
			scale,
			scrollLeft: viewport.scrollLeft,
			scrollTop: viewport.scrollTop,
			version: 1,
		});
	});
}

function showMessage(text: string): void {
	message.textContent = text;
}

function showToast(text: string): void {
	toast.textContent = text;
	toast.classList.add('visible');
	if (toastTimer !== undefined) {
		window.clearTimeout(toastTimer);
	}
	toastTimer = window.setTimeout(() => {
		toast.classList.remove('visible');
		toastTimer = undefined;
	}, 2_400);
}

function parseHostMessage(value: unknown): HostMessage | undefined {
	if (!isRecord(value) || typeof value.type !== 'string') {
		return undefined;
	}

	switch (value.type) {
		case 'command':
			return isViewerCommand(value.command) ? { command: value.command, type: 'command' } : undefined;
		case 'environment':
			return isEnvironment(value) ? {
				defaultBackground: value.defaultBackground,
				defaultZoom: value.defaultZoom,
				themeKind: value.themeKind,
				type: 'environment',
			} : undefined;
		case 'imageUnavailable':
			return typeof value.message === 'string' ? { message: value.message, type: 'imageUnavailable' } : undefined;
		case 'loadImage':
			return isEnvironment(value)
				&& typeof value.documentKey === 'string'
				&& typeof value.source === 'string'
				? {
					defaultBackground: value.defaultBackground,
					defaultZoom: value.defaultZoom,
					documentKey: value.documentKey,
					source: value.source,
					themeKind: value.themeKind,
					type: 'loadImage',
				}
				: undefined;
		default:
			return undefined;
	}
}

function isEnvironment(value: Record<string, unknown>): value is Record<string, unknown> & {
	themeKind: number;
	defaultBackground: BackgroundPreference;
	defaultZoom: ZoomMode;
} {
	return typeof value.themeKind === 'number'
		&& Number.isFinite(value.themeKind)
		&& isBackgroundPreference(value.defaultBackground)
		&& isZoomMode(value.defaultZoom);
}

function isViewerCommand(value: unknown): value is ViewerCommand {
	return value === 'actualSize'
		|| value === 'copy'
		|| value === 'fitWidth'
		|| value === 'toggleBackground'
		|| value === 'zoomIn'
		|| value === 'zoomOut';
}

function isBackgroundMode(value: unknown): value is BackgroundMode {
	return value === 'white' || value === 'checkerboard' || value === 'editor';
}

function isBackgroundPreference(value: unknown): value is BackgroundPreference {
	return value === 'auto' || isBackgroundMode(value);
}

function isZoomMode(value: unknown): value is ZoomMode {
	return value === 'fitWidth' || value === 'fit' || value === 'actualSize';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getElement<T extends Element>(id: string): T {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing webview element: ${id}`);
	}
	return element as unknown as T;
}
