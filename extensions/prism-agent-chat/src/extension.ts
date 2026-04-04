import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import { ChatPanelProvider } from './chatPanel';

let client: AgentClient;

export function activate(context: vscode.ExtensionContext): void {
  client = new AgentClient();
  const chatProvider = new ChatPanelProvider(context.extensionUri, client);

  // Register the sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, chatProvider),
  );

  // Commands
  context.subscriptions.push(
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
      chatProvider.sendContextMessage(
        `Explain this code from ${fileName}:\n\`\`\`\n${selection}\n\`\`\``,
      );
    }),

    vscode.commands.registerCommand('prism.agent.askAboutFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const fileName = editor.document.fileName.split('/').pop();
      chatProvider.sendContextMessage(
        `What does the file ${fileName} do? Here's its content:\n\`\`\`\n${editor.document.getText()}\n\`\`\``,
      );
    }),
  );

  // Clean up
  context.subscriptions.push({ dispose: () => client.dispose() });
}

export function deactivate(): void {
  client?.dispose();
}
