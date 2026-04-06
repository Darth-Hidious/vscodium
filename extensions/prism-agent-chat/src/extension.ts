import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import { ChatPanelProvider } from './chatPanel';
import { FloatingChatPanel } from './floatingChat';
import type { PrismAgentApi } from './api';

let client: AgentClient;

export function activate(context: vscode.ExtensionContext): PrismAgentApi {
  client = new AgentClient();
  const chatProvider = new ChatPanelProvider(context.extensionUri, client);

  // Register the sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, chatProvider),
  );

  // Floating chat button in status bar
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, 1000,
  );
  statusBarItem.text = '$(comment-discussion) PRISM Agent';
  statusBarItem.tooltip = 'Open PRISM Agent Chat';
  statusBarItem.command = 'prism.agent.openFloatingChat';
  statusBarItem.backgroundColor = undefined;
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('prism.agent.openFloatingChat', () => {
      FloatingChatPanel.createOrShow(context.extensionUri, client);
    }),

    vscode.commands.registerCommand('prism.agent.newChat', () => {
      client.disconnect();
      chatProvider.clearChat();
      client.connect();
    }),

    vscode.commands.registerCommand('prism.agent.clearChat', () => {
      chatProvider.clearChat();
    }),

    vscode.commands.registerCommand('prism.agent.toggleAutoApprove', () => {
      const config = vscode.workspace.getConfiguration('prism.agent');
      const current = config.get<boolean>('autoApprove', false);
      config.update('autoApprove', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `PRISM auto-approve: ${!current ? 'ON' : 'OFF'}`,
      );
    }),

    vscode.commands.registerCommand('prism.agent.askAboutSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      if (!selection) { return; }
      const fileName = editor.document.fileName.split('/').pop();
      FloatingChatPanel.createOrShow(context.extensionUri, client);
      FloatingChatPanel.sendContextMessage(
        `Explain this code from ${fileName}:\n\`\`\`\n${selection}\n\`\`\``,
      );
    }),

    vscode.commands.registerCommand('prism.agent.askAboutFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const fileName = editor.document.fileName.split('/').pop();
      FloatingChatPanel.createOrShow(context.extensionUri, client);
      FloatingChatPanel.sendContextMessage(
        `What does the file ${fileName} do? Here's its content:\n\`\`\`\n${editor.document.getText()}\n\`\`\``,
      );
    }),

    vscode.commands.registerCommand('prism.agent.sendMessage', (text: string) => {
      if (typeof text === 'string' && text.trim()) {
        client.connect();
        client.sendMessage(text);
      }
    }),

    vscode.commands.registerCommand('prism.agent.sendContext', (text: string) => {
      if (typeof text === 'string' && text.trim()) {
        client.connect();
        FloatingChatPanel.createOrShow(context.extensionUri, client);
        FloatingChatPanel.sendContextMessage(text);
      }
    }),
  );

  // Clean up
  context.subscriptions.push({ dispose: () => client.dispose() });

  // Public API for other PRISM extensions
  const api: PrismAgentApi = {
    sendMessage: (text: string) => {
      client.connect();
      client.sendMessage(text);
    },
    onEvent: client.onEvent,
    onStateChange: client.onStateChange,
    get state() { return client.state; },
    ensureConnected: () => client.connect(),
  };
  return api;
}

export function deactivate(): void {
  client?.dispose();
}
