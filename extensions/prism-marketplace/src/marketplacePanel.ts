import * as vscode from 'vscode';

interface MarketplaceItem {
	id: string;
	name: string;
	description: string;
	author: string;
	category: string;
	installs: number;
	rating: number;
	version: string;
}

export class MarketplaceViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'prism.marketplace.browse';

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'media')
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.type) {
				case 'search':
					await this._handleSearch(message.query, message.category);
					break;
				case 'install':
					await this._handleInstall(message.id, message.name);
					break;
				case 'info':
					await this._handleInfo(message.id);
					break;
				case 'ready':
					// Webview loaded, perform initial fetch
					await this._handleSearch('', 'all');
					break;
			}
		});
	}

	public performSearch(query: string): void {
		this._view?.webview.postMessage({ type: 'setSearch', query });
	}

	public refresh(): void {
		this._view?.webview.postMessage({ type: 'refresh' });
	}

	public installPackage(identifier: string): void {
		this._view?.webview.postMessage({ type: 'triggerInstall', id: identifier });
	}

	private _getServerUrl(): string {
		const config = vscode.workspace.getConfiguration('prism.marketplace');
		return config.get<string>('serverUrl', 'http://127.0.0.1:7327');
	}

	private async _handleSearch(query: string, category: string): Promise<void> {
		const serverUrl = this._getServerUrl();

		try {
			const params = new URLSearchParams();
			if (query) { params.set('q', query); }
			if (category && category !== 'all') { params.set('category', category); }

			const url = `${serverUrl}/api/tools?${params.toString()}`;
			const response = await fetch(url, {
				headers: { 'Accept': 'application/json' },
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json() as { tools?: MarketplaceItem[] };
			const items: MarketplaceItem[] = (data.tools ?? []).map((t: any) => ({
				id: t.name || t.id || '',
				name: t.display_name || t.name || '',
				description: t.description || '',
				author: t.author || 'PRISM',
				category: t.category || category || 'tools',
				installs: t.usage_count || 0,
				rating: t.rating || 0,
				version: t.version || '0.1.0',
			}));
			this._view?.webview.postMessage({ type: 'searchResults', items });
		} catch (_err) {
			// Fallback: ask agent to list tools
			try {
				await vscode.commands.executeCommand('prism.agent.sendMessage',
					`/tools${query ? ' ' + query : ''}`
				);
				this._view?.webview.postMessage({
					type: 'searchResults',
					items: [],
					fallbackMessage: 'Results shown in Agent Chat — open the PRISM Agent panel to see available tools.',
				});
			} catch {
				this._view?.webview.postMessage({
					type: 'searchError',
					message: 'PRISM server not running. Start it with: prism node start',
				});
			}
		}
	}

	private async _handleInstall(id: string, name: string): Promise<void> {
		const confirm = await vscode.window.showInformationMessage(
			`Install "${name}" from PRISM?`,
			{ modal: true },
			'Install'
		);
		if (confirm !== 'Install') { return; }

		try {
			await vscode.commands.executeCommand('prism.agent.sendMessage', `/tools install ${id}`);
			vscode.window.showInformationMessage(`Installing "${name}" via PRISM agent — check Agent Chat for progress.`);
			this._view?.webview.postMessage({ type: 'installComplete', id });
		} catch {
			vscode.window.showErrorMessage(`Failed to install "${name}".`);
			this._view?.webview.postMessage({ type: 'installFailed', id });
		}
	}

	private async _handleInfo(id: string): Promise<void> {
		const serverUrl = this._getServerUrl();

		try {
			const response = await fetch(`${serverUrl}/api/tools/${encodeURIComponent(id)}`, {
				headers: { 'Accept': 'application/json' },
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const item = await response.json() as MarketplaceItem & { readme?: string };
			this._view?.webview.postMessage({ type: 'itemInfo', item });
		} catch (_err) {
			vscode.window.showErrorMessage('Failed to load package details.');
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const cssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'media', 'marketplace.css')
		);
		const jsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'media', 'marketplace.js')
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<link rel="stylesheet" href="${cssUri}">
	<title>MARC27 Marketplace</title>
</head>
<body>
	<div id="marketplace-root">
		<div class="search-container">
			<input type="text" id="search-input" placeholder="Search tools, workflows, models..." autocomplete="off" spellcheck="false">
		</div>
		<div class="category-tabs" id="category-tabs">
			<button class="category-tab active" data-category="all">All</button>
			<button class="category-tab" data-category="tools">Tools</button>
			<button class="category-tab" data-category="workflows">Workflows</button>
			<button class="category-tab" data-category="models">Models</button>
			<button class="category-tab" data-category="datasets">Datasets</button>
		</div>
		<div id="results-container" class="results-grid"></div>
		<div id="status-message" class="status-message" style="display:none;"></div>
		<div id="loading-indicator" class="loading" style="display:none;">
			<div class="spinner"></div>
			<span>Searching marketplace...</span>
		</div>
	</div>
	<script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
