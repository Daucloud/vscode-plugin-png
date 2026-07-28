export interface WebviewHtmlResources {
	readonly cspSource: string;
	readonly nonce: string;
	readonly scriptUri: string;
	readonly styleUri: string;
}

export function getWebviewHtml(resources: WebviewHtmlResources): string {
	const cspSource = escapeHtmlAttribute(resources.cspSource);
	const nonce = escapeHtmlAttribute(resources.nonce);
	const scriptUri = escapeHtmlAttribute(resources.scriptUri);
	const styleUri = escapeHtmlAttribute(resources.styleUri);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob:; style-src ${cspSource}; script-src 'nonce-${nonce}';">
	<link rel="stylesheet" href="${styleUri}">
	<title>Image Viewer</title>
</head>
<body>
	<main id="viewport" tabindex="0" aria-label="Image viewport">
		<div id="stage">
			<div id="image-surface" class="background-editor" hidden>
				<img id="image" alt="Image preview" draggable="false">
			</div>
		</div>
	</main>
	<div id="toolbar" role="toolbar" aria-label="Image controls">
		<button type="button" data-viewer-command="zoomOut" title="Zoom out (Ctrl/Cmd+-)" aria-label="Zoom out">−</button>
		<button id="zoom-status" type="button" data-viewer-command="fitWidth" title="Fit to width (Ctrl/Cmd+0)">100%</button>
		<button type="button" data-viewer-command="zoomIn" title="Zoom in (Ctrl/Cmd+=)" aria-label="Zoom in">+</button>
		<span class="separator" aria-hidden="true"></span>
		<button type="button" data-viewer-command="actualSize" title="Actual size (Ctrl/Cmd+1)">1:1</button>
		<button id="background-button" type="button" data-viewer-command="toggleBackground" title="Cycle background (B)">Background</button>
		<button type="button" data-viewer-command="copy" title="Copy image (Ctrl/Cmd+C)">Copy</button>
	</div>
	<div id="metadata" aria-live="polite"></div>
	<div id="message" role="status" aria-live="polite">Loading image…</div>
	<div id="toast" role="status" aria-live="polite"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
