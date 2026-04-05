import * as vscode from 'vscode';
import { MaterialsPanelProvider } from './materialsPanel';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MaterialsPanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MaterialsPanelProvider.viewType,
      provider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prism.materials.openPeriodicTable', () => {
      // Focus the sidebar view — the webview auto-renders the table
      vscode.commands.executeCommand('prism.materials.explorer.focus');
    }),

    vscode.commands.registerCommand('prism.materials.searchMaterials', () => {
      provider.triggerSearch();
    }),

    vscode.commands.registerCommand('prism.materials.askAgent', () => {
      const composition = provider.getCurrentComposition();
      if (!composition) {
        vscode.window.showWarningMessage('Select elements in the periodic table first.');
        return;
      }
      // Send to PRISM agent chat if available
      vscode.commands.executeCommand('prism.agent.newChat').then(
        () => {
          // Small delay to let chat initialize, then send context
          setTimeout(() => {
            vscode.commands.executeCommand(
              'prism.agent.sendContext',
              `Analyze this material composition and suggest properties, applications, and similar alloys:\n${composition}`,
            );
          }, 300);
        },
        () => {
          // Agent chat not available — show in info message
          vscode.window.showInformationMessage(`Composition: ${composition}`);
        },
      );
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up
}
