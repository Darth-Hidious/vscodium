import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import type { AgentEvent, ConnectionState } from './types';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * WebView-based chat panel that renders agent conversations.
 * Registered as a sidebar view in the PRISM Agent activity bar container.
 */
export class ChatPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prism.agentChat';
  private view?: vscode.WebviewView;
  private readonly client: AgentClient;

  constructor(
    private readonly extensionUri: vscode.Uri,
    client: AgentClient,
  ) {
    this.client = client;

    // Forward agent events to webview
    this.client.onEvent((event: AgentEvent) => this.postToWebview({ type: 'agent-event', event }));
    this.client.onStateChange((state: ConnectionState) => this.postToWebview({ type: 'connection-state', state }));
  }

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

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.type) {
        case 'send-message':
          this.client.sendMessage(msg.text);
          break;
        case 'approve-tool':
          this.client.sendApproval(msg.callId, msg.approved);
          break;
        case 'ready':
          this.client.connect();
          this.postToWebview({ type: 'connection-state', state: this.client.state });
          break;
      }
    });

    // Reconnect when view becomes visible again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this.client.state === 'disconnected') {
        this.client.connect();
      }
    });
  }

  /** Send a pre-filled message to the agent (from editor context menu etc.) */
  sendContextMessage(text: string): void {
    this.client.sendMessage(text);
    this.postToWebview({ type: 'context-message', text });
  }

  clearChat(): void {
    this.postToWebview({ type: 'clear' });
  }

  private postToWebview(msg: unknown): void {
    this.view?.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>PRISM Agent</title>
</head>
<body>
  <div id="connection-bar">
    <span id="connection-dot"></span>
    <span id="connection-text">Connecting...</span>
  </div>

  <div id="messages"></div>

  <div id="approval-bar" class="hidden">
    <span id="approval-text"></span>
    <button id="btn-approve" class="approve">Approve</button>
    <button id="btn-deny" class="deny">Deny</button>
    <button id="btn-always" class="always">Always</button>
  </div>

  <div id="input-bar">
    <textarea id="input" rows="1" placeholder="Ask the PRISM agent..."></textarea>
    <button id="btn-send" title="Send">
      <span class="codicon codicon-send"></span>
    </button>
  </div>

  <div id="cost-bar">
    <span id="cost-text"></span>
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
