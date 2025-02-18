import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	console.log('PNG Editor is now active');
	const provider = new PngEditorProvider();
	context.subscriptions.push(vscode.window.registerCustomEditorProvider(
		'pngEditor',
		provider,
		{ supportsMultipleEditorsPerDocument: false }
	));
}

class PngEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
	async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
		console.log(`Opening document: ${uri.fsPath}`);
		return { uri, dispose: () => {} };
	}

	async resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel) {
		const filePath = document.uri.fsPath;
		
		// 使用 vscode-resource 协议转换 URI
		const imageUri = panel.webview.asWebviewUri(vscode.Uri.file(filePath));
		// 添加版本号防止缓存
		const versionedUri = `${imageUri}?version=${Date.now()}`;

		// 设置允许的脚本和资源
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(path.dirname(filePath)),
				vscode.Uri.file(path.join(__dirname, '..')),
			]
		};

		panel.webview.html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" 
					content="default-src 'none'; 
							img-src vscode-resource: https: data:; 
							script-src 'unsafe-inline';
							style-src 'unsafe-inline';">
				<style>
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}
					
					html, body {
						width: 100%;
						height: 100vh;
						overflow: hidden;
					}
					
					body {
						display: flex;
						justify-content: center;
						align-items: center;
						background-color: var(--vscode-editor-background);
					}
					
					.container {
						position: absolute;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						width: 100%;
						height: 100%;
						display: flex;
						justify-content: center;
						align-items: center;
						overflow: hidden;
					}
					
					canvas {
						max-width: 100%;
						max-height: 100%;
						object-fit: contain;
						display: block;
						margin: auto;
						transform-origin: center center;
					}

					.scale-to-fit {
						width: auto;
						height: auto;
						max-width: 90%;
						max-height: 90%;
					}
				</style>
			</head>
			<body>
				<div class="container">
					<canvas id="canvas"></canvas>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const canvas = document.getElementById('canvas');
					const ctx = canvas.getContext('2d');
					let img = new Image();
					
					window.addEventListener('message', event => {
						const message = event.data;
						console.log('Received message:', message);
						switch (message.command) {
							case 'loadImage':
								loadImage(message.filePath, message.themeKind);
								break;
						}
					});

					// 添加缩放状态变量
					let scale = 1;
					let isDragging = false;
					let startX, startY, translateX = 0, translateY = 0;

					// 添加鼠标滚轮缩放
					canvas.addEventListener('wheel', (e) => {
						if (e.ctrlKey || e.metaKey) {
							e.preventDefault();
							const delta = e.deltaY;
							const scaleChange = delta > 0 ? 0.9 : 1.1;
							scale = Math.min(Math.max(0.1, scale * scaleChange), 5);
							updateCanvasTransform();
						}
					}, { passive: false });

					// 添加拖动功能
					canvas.addEventListener('mousedown', (e) => {
						isDragging = true;
						startX = e.clientX - translateX;
						startY = e.clientY - translateY;
						canvas.style.cursor = 'grabbing';
					});

					window.addEventListener('mousemove', (e) => {
						if (isDragging) {
							translateX = e.clientX - startX;
							translateY = e.clientY - startY;
							updateCanvasTransform();
						}
					});

					window.addEventListener('mouseup', () => {
						isDragging = false;
						canvas.style.cursor = 'grab';
					});

					// 更新 canvas 变换
					function updateCanvasTransform() {
						canvas.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
					}

					function loadImage(filePath, themeKind) {
						console.log('Loading image:', filePath);
						console.log('Theme kind:', themeKind);
						
						img.src = filePath;
						img.onload = () => {
							console.log('Image loaded, dimensions:', img.width, 'x', img.height);
							canvas.width = img.width;
							canvas.height = img.height;

							if (themeKind === 2 && isTransparent(img)) { // 2 represents Dark theme
								console.log('Applying white background for transparent image in dark theme');
								ctx.fillStyle = 'white';
								ctx.fillRect(0, 0, canvas.width, canvas.height);
							}

							ctx.drawImage(img, 0, 0);

							// 重置缩放和位置
							scale = 1;
							translateX = 0;
							translateY = 0;
							updateCanvasTransform();
							canvas.style.cursor = 'grab';
						};
						
						img.onerror = (err) => {
							console.error('Error loading image:', err);
							vscode.postMessage({
								command: 'error',
								message: 'Failed to load image'
							});
						};
					}

					function isTransparent(image) {
						const canvasTest = document.createElement('canvas');
						canvasTest.width = image.width;
						canvasTest.height = image.height;
						const ctxTest = canvasTest.getContext('2d');
						ctxTest.drawImage(image, 0, 0);
						
						const imageData = ctxTest.getImageData(0, 0, canvasTest.width, canvasTest.height);
						const data = imageData.data;
						
						for (let i = 3; i < data.length; i += 4) {
							if (data[i] < 255) {
								return true;
							}
						}
						return false;
					}
				</script>
			</body>
			</html>
		`;

			// 使用带版本号的 URI 发送消息
			panel.webview.postMessage({
				command: 'loadImage',
				filePath: versionedUri,
				themeKind: vscode.window.activeColorTheme.kind
			});
	}
}

export function deactivate() {}
