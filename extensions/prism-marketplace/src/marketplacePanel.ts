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

	private _getApiUrl(): string {
		const config = vscode.workspace.getConfiguration('prism.marketplace');
		return config.get<string>('apiUrl', 'https://api.marc27.com/api/v1');
	}

	private async _handleSearch(query: string, category: string): Promise<void> {
		const apiUrl = this._getApiUrl();
		const params = new URLSearchParams();
		if (query) {
			params.set('q', query);
		}
		if (category && category !== 'all') {
			params.set('category', category);
		}

		try {
			const url = `${apiUrl}/marketplace/search?${params.toString()}`;
			const response = await fetch(url, {
				headers: { 'Accept': 'application/json' },
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json() as { items?: MarketplaceItem[] };
			const items: MarketplaceItem[] = data.items ?? [];
			this._view?.webview.postMessage({ type: 'searchResults', items });
		} catch (_err) {
			this._view?.webview.postMessage({
				type: 'searchError',
				message: 'Cannot connect to MARC27 marketplace. Check your network connection and API URL in settings.'
			});
		}
	}

	private async _handleInstall(id: string, name: string): Promise<void> {
		const confirm = await vscode.window.showInformationMessage(
			`Install "${name}" from MARC27 Marketplace?`,
			{ modal: true },
			'Install'
		);

		if (confirm !== 'Install') {
			return;
		}

		const apiUrl = this._getApiUrl();

		try {
			const response = await fetch(`${apiUrl}/marketplace/install`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify({ id }),
				signal: AbortSignal.timeout(30000)
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			vscode.window.showInformationMessage(`Successfully installed "${name}".`);
			this._view?.webview.postMessage({ type: 'installComplete', id });
		} catch (_err) {
			vscode.window.showErrorMessage(
				`Failed to install "${name}". Check your connection to the MARC27 marketplace.`
			);
			this._view?.webview.postMessage({ type: 'installFailed', id });
		}
	}

	private async _handleInfo(id: string): Promise<void> {
		const apiUrl = this._getApiUrl();

		try {
			const response = await fetch(`${apiUrl}/marketplace/info/${encodeURIComponent(id)}`, {
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
