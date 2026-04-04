import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import type { AgentEvent, ConnectionState } from './types';

/**
 * Full-canvas chat panel that opens as an editor tab.
 * Click the status bar "PRISM Agent" button → opens this.
 * Styled as a modern chat canvas with the conversation front and center.
 */
export class FloatingChatPanel {
  public static readonly viewType = 'prism.floatingChat';
  private static currentPanel: FloatingChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly client: AgentClient;

  public static createOrShow(extensionUri: vscode.Uri, client: AgentClient): void {
    if (FloatingChatPanel.currentPanel) {
      FloatingChatPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      FloatingChatPanel.viewType,
      'PRISM Agent',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );
    FloatingChatPanel.currentPanel = new FloatingChatPanel(panel, extensionUri, client);
  }

  public static sendContextMessage(text: string): void {
    FloatingChatPanel.currentPanel?.postToWebview({ type: 'context-message', text });
    FloatingChatPanel.currentPanel?.client.sendMessage(text);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, client: AgentClient) {
    this.panel = panel;
    this.client = client;

    const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'canvas.css'));
    const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.js'));
    const nonce = getNonce();

    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'prism-icon.svg');

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>PRISM Agent</title>
</head>
<body>
  <div id="header">
    <div id="header-left">
      <span id="prism-logo">&#9671;</span>
      <span id="header-title">PRISM Agent</span>
    </div>
    <div id="header-right">
      <span id="connection-dot"></span>
      <span id="connection-text">Connecting...</span>
    </div>
  </div>

  <div id="messages"></div>

  <div id="approval-bar" class="hidden">
    <span id="approval-text"></span>
    <button id="btn-approve" class="approve">Approve</button>
    <button id="btn-deny" class="deny">Deny</button>
    <button id="btn-always" class="always">Always</button>
  </div>

  <div id="input-area">
    <div id="input-bar">
      <textarea id="input" rows="1" placeholder="Ask anything — materials, code, data, or science..."></textarea>
      <button id="btn-send" title="Send">&#9654;</button>
    </div>
    <div id="cost-bar">
      <span id="cost-text"></span>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;

    // Forward agent events to webview
    this.client.onEvent((event: AgentEvent) => this.postToWebview({ type: 'agent-event', event }));
    this.client.onStateChange((state: ConnectionState) => this.postToWebview({ type: 'connection-state', state }));

    // Handle messages from webview
    panel.webview.onDidReceiveMessage((msg: any) => {
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

    panel.onDidDispose(() => {
      FloatingChatPanel.currentPanel = undefined;
    });
  }

  private postToWebview(msg: unknown): void {
    this.panel.webview.postMessage(msg);
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
