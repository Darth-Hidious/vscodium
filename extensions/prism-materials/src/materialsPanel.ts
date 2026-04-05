import * as vscode from 'vscode';

/**
 * Webview provider for the Materials Explorer sidebar panel.
 * Renders an interactive periodic table with composition builder,
 * property filters, and agent integration.
 */
export class MaterialsPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prism.materials.explorer';

  private view?: vscode.WebviewView;
  private composition: string = '';

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
      switch (msg.type) {
        case 'search':
          this.composition = msg.composition as string;
          this.handleSearch(msg);
          break;
        case 'ask-agent':
          this.composition = msg.composition as string;
          vscode.commands.executeCommand('prism.materials.askAgent');
          break;
        case 'composition-changed':
          this.composition = msg.composition as string;
          break;
      }
    });
  }

  /** Returns the current composition string for use by commands. */
  getCurrentComposition(): string {
    return this.composition;
  }

  /** Trigger a search from the command palette. */
  triggerSearch(): void {
    this.postToWebview({ type: 'trigger-search' });
  }

  private handleSearch(msg: Record<string, unknown>): void {
    const composition = msg.composition as string;
    const filters = msg.filters as Record<string, unknown> | undefined;

    // Show progress
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Searching materials...' },
      async () => {
        // In a full build this calls the PRISM server.
        // For now, confirm the query and show what would be sent.
        const filterStr = filters
          ? Object.entries(filters)
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : '';

        const detail = filterStr
          ? `Composition: ${composition}\nFilters: ${filterStr}`
          : `Composition: ${composition}`;

        vscode.window.showInformationMessage(`PRISM search:\n${detail}`);

        // Send results back to the webview when the server is wired
        this.postToWebview({
          type: 'search-results',
          query: composition,
          results: [],
        });
      },
    );
  }

  private postToWebview(msg: unknown): void {
    this.view?.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'materials.css'),
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'materials.js'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>Materials Explorer</title>
</head>
<body>
  <div id="materials-root">
    <header id="header">
      <h2>Periodic Table</h2>
      <span id="element-info"></span>
    </header>

    <div id="periodic-table"></div>

    <div id="lanthanide-label" class="series-label">Lanthanides</div>
    <div id="lanthanides"></div>
    <div id="actinide-label" class="series-label">Actinides</div>
    <div id="actinides"></div>

    <section id="composition-section">
      <h3>Composition</h3>
      <div id="composition-list">
        <p class="placeholder">Click elements above to build a composition</p>
      </div>
      <div id="composition-total"></div>
    </section>

    <section id="filters-section">
      <h3>Property Filters</h3>
      <div class="filter-row">
        <label>Melting Point (K)</label>
        <input type="number" id="filter-mp-min" placeholder="Min" step="100">
        <span class="filter-sep">&ndash;</span>
        <input type="number" id="filter-mp-max" placeholder="Max" step="100">
      </div>
      <div class="filter-row">
        <label>Density (g/cm3)</label>
        <input type="number" id="filter-density-min" placeholder="Min" step="0.5">
        <span class="filter-sep">&ndash;</span>
        <input type="number" id="filter-density-max" placeholder="Max" step="0.5">
      </div>
      <div class="filter-row">
        <label>Band Gap (eV)</label>
        <input type="number" id="filter-bg-min" placeholder="Min" step="0.1">
        <span class="filter-sep">&ndash;</span>
        <input type="number" id="filter-bg-max" placeholder="Max" step="0.1">
      </div>
    </section>

    <section id="actions-section">
      <button id="btn-search" class="action-btn primary">Search Materials</button>
      <button id="btn-ask-agent" class="action-btn secondary">Ask Agent</button>
    </section>

    <section id="results-section" class="hidden">
      <h3>Results</h3>
      <div id="results-list"></div>
    </section>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
