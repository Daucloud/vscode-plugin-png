import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { BackgroundPreference, ZoomMode } from './viewerModel';

export const VIEW_TYPE = 'darkThemeImageViewEditor';

type ViewerCommand =
	| 'actualSize'
	| 'copy'
	| 'fitWidth'
	| 'toggleBackground'
	| 'zoomIn'
	| 'zoomOut';

interface ViewerEnvironment {
	readonly defaultBackground: BackgroundPreference;
	readonly defaultZoom: ZoomMode;
	readonly themeKind: number;
}

interface PanelState {
	readonly document: vscode.CustomDocument;
	readonly panel: vscode.WebviewPanel;
	readonly disposables: vscode.Disposable[];
	ready: boolean;
	lastVersion: string | undefined;
	pendingCommands: ViewerCommand[];
	refreshSequence: number;
}

export function activate(context: vscode.ExtensionContext): void {
	const provider = new ImageEditorProvider(context.extensionUri);
	context.subscriptions.push(provider);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			VIEW_TYPE,
			provider,
			{
				supportsMultipleEditorsPerDocument: false,
				webviewOptions: { retainContextWhenHidden: false },
			},
		),
	);

	const commands: readonly [string, ViewerCommand][] = [
		['darkThemeImageView.copyImage', 'copy'],
		['darkThemeImageView.toggleBackground', 'toggleBackground'],
		['darkThemeImageView.zoomIn', 'zoomIn'],
		['darkThemeImageView.zoomOut', 'zoomOut'],
		['darkThemeImageView.fitWidth', 'fitWidth'],
		['darkThemeImageView.actualSize', 'actualSize'],
	];
	for (const [commandId, command] of commands) {
		context.subscriptions.push(vscode.commands.registerCommand(commandId, () => {
			provider.sendCommand(command);
		}));
	}

	context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(() => {
		provider.updateEnvironment();
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('darkThemeImageView.defaultBackground')
			|| event.affectsConfiguration('darkThemeImageView.defaultZoom')) {
			provider.updateEnvironment();
		}
	}));
}

export function deactivate(): void {
	// All resources are owned by the extension context and provider disposables.
}

class ImageEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument>, vscode.Disposable {
	private readonly panels = new Map<vscode.WebviewPanel, PanelState>();

	public constructor(private readonly extensionUri: vscode.Uri) {}

	public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
		return {
			dispose: () => undefined,
			uri,
		};
	}

	public async resolveCustomEditor(
		document: vscode.CustomDocument,
		panel: vscode.WebviewPanel,
	): Promise<void> {
		const state: PanelState = {
			document,
			disposables: [],
			panel,
			pendingCommands: [],
			ready: false,
			lastVersion: undefined,
			refreshSequence: 0,
		};
		this.panels.set(panel, state);

		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'dist'),
				vscode.Uri.joinPath(this.extensionUri, 'media'),
				getParentUri(document.uri),
			],
		};

		state.disposables.push(
			panel.webview.onDidReceiveMessage((message: unknown) => {
				this.handleWebviewMessage(state, message);
			}),
			panel.onDidChangeViewState(() => {
				if (panel.visible) {
					void this.refreshPanel(state, false);
				}
			}),
		);
		panel.onDidDispose(() => {
			this.disposePanel(state);
		});
		this.addFileWatcher(state);
		panel.webview.html = this.createWebviewHtml(panel.webview);
		await this.refreshPanel(state, true);
	}

	public sendCommand(command: ViewerCommand): void {
		const state = this.getActivePanel();
		if (state === undefined) {
			void vscode.window.showInformationMessage('Open an image in Dark Theme Image View first.');
			return;
		}
		if (!state.ready) {
			state.pendingCommands.push(command);
			return;
		}
		void state.panel.webview.postMessage({ command, type: 'command' });
	}

	public updateEnvironment(): void {
		for (const state of this.panels.values()) {
			if (state.ready) {
				void state.panel.webview.postMessage({
					...this.getEnvironment(state.document.uri),
					type: 'environment',
				});
			}
		}
	}

	public dispose(): void {
		for (const state of this.panels.values()) {
			this.disposePanel(state);
		}
		this.panels.clear();
	}

	private createWebviewHtml(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'image-viewer.css'));
		return getWebviewHtml({
			cspSource: webview.cspSource,
			nonce: randomBytes(16).toString('base64'),
			scriptUri: scriptUri.toString(),
			styleUri: styleUri.toString(),
		});
	}

	private async refreshPanel(state: PanelState, force: boolean): Promise<void> {
		if (!state.ready && !force) {
			return;
		}

		const sequence = ++state.refreshSequence;
		try {
			const stat = await vscode.workspace.fs.stat(state.document.uri);
			if (sequence !== state.refreshSequence) {
				return;
			}

			const version = `${stat.mtime}-${stat.size}`;
			if (!force && state.lastVersion === version) {
				return;
			}

			state.lastVersion = version;
			const source = state.panel.webview
				.asWebviewUri(state.document.uri)
				.with({ query: `v=${encodeURIComponent(version)}` })
				.toString();
			void state.panel.webview.postMessage({
				...this.getEnvironment(state.document.uri),
				documentKey: state.document.uri.toString(),
				source,
				type: 'loadImage',
			});
		} catch (error) {
			if (sequence !== state.refreshSequence) {
				return;
			}
			state.lastVersion = undefined;
			void state.panel.webview.postMessage({
				message: `Unable to read ${getFileName(state.document.uri)}.`,
				type: 'imageUnavailable',
			});
			console.error('Failed to refresh image document', state.document.uri.toString(), error);
		}
	}

	private handleWebviewMessage(state: PanelState, message: unknown): void {
		if (!isRecord(message) || typeof message.type !== 'string') {
			return;
		}

		switch (message.type) {
			case 'ready':
				state.ready = true;
				for (const command of state.pendingCommands.splice(0)) {
					void state.panel.webview.postMessage({ command, type: 'command' });
				}
				void this.refreshPanel(state, true);
				break;
			case 'copyError':
				if (typeof message.message === 'string') {
					void vscode.window.showWarningMessage(`Could not copy image: ${message.message}`);
				}
				break;
			case 'loadError':
				if (typeof message.message === 'string') {
					void vscode.window.showErrorMessage(message.message);
				}
				break;
			case 'copySucceeded':
				break;
			default:
				break;
		}
	}

	private addFileWatcher(state: PanelState): void {
		try {
			const watcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(getParentUri(state.document.uri), '*'),
			);
			const isDocument = (uri: vscode.Uri): boolean => uri.toString() === state.document.uri.toString();
			state.disposables.push(
				watcher,
				watcher.onDidChange((uri) => {
					if (isDocument(uri)) {
						void this.refreshPanel(state, true);
					}
				}),
				watcher.onDidCreate((uri) => {
					if (isDocument(uri)) {
						void this.refreshPanel(state, true);
					}
				}),
				watcher.onDidDelete((uri) => {
					if (isDocument(uri)) {
						state.lastVersion = undefined;
						void state.panel.webview.postMessage({
							message: `${getFileName(uri)} is no longer available.`,
							type: 'imageUnavailable',
						});
					}
				}),
			);
		} catch (error) {
			// Some virtual file systems do not expose watch events. Visibility
			// changes still trigger a stat-based refresh, so viewing remains usable.
			console.warn('File watching is unavailable for', state.document.uri.toString(), error);
		}
	}

	private getActivePanel(): PanelState | undefined {
		for (const state of this.panels.values()) {
			if (state.panel.active && state.panel.visible) {
				return state;
			}
		}
		for (const state of this.panels.values()) {
			if (state.panel.visible) {
				return state;
			}
		}
		return undefined;
	}

	private getEnvironment(uri: vscode.Uri): ViewerEnvironment {
		const configuration = vscode.workspace.getConfiguration('darkThemeImageView', uri);
		const defaultBackground = configuration.get<BackgroundPreference>('defaultBackground', 'auto');
		const defaultZoom = configuration.get<ZoomMode>('defaultZoom', 'fitWidth');
		return {
			defaultBackground: isBackgroundPreference(defaultBackground) ? defaultBackground : 'auto',
			defaultZoom: isZoomMode(defaultZoom) ? defaultZoom : 'fitWidth',
			themeKind: vscode.window.activeColorTheme.kind,
		};
	}

	private disposePanel(state: PanelState): void {
		for (const disposable of state.disposables) {
			disposable.dispose();
		}
		this.panels.delete(state.panel);
	}
}

function getParentUri(uri: vscode.Uri): vscode.Uri {
	const slash = uri.path.lastIndexOf('/');
	return uri.with({
		fragment: '',
		path: slash > 0 ? uri.path.slice(0, slash) : '/',
		query: '',
	});
}

function getFileName(uri: vscode.Uri): string {
	const slash = uri.path.lastIndexOf('/');
	return slash >= 0 ? uri.path.slice(slash + 1) : uri.path;
}

function isBackgroundPreference(value: unknown): value is BackgroundPreference {
	return value === 'auto'
		|| value === 'white'
		|| value === 'checkerboard'
		|| value === 'editor';
}

function isZoomMode(value: unknown): value is ZoomMode {
	return value === 'fitWidth' || value === 'fit' || value === 'actualSize';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
