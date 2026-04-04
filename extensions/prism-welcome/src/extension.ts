import * as vscode from 'vscode';
import { WelcomePanel } from './welcomePanel';

export function activate(context: vscode.ExtensionContext): void {
  // Register the command
  context.subscriptions.push(
    vscode.commands.registerCommand('prism.welcome.show', () => {
      WelcomePanel.createOrShow(context.extensionUri);
    }),
  );

  // Show on startup if configured
  const config = vscode.workspace.getConfiguration('prism.welcome');
  if (config.get<boolean>('showOnStartup', true)) {
    // Small delay so it doesn't race with window restoration
    setTimeout(() => WelcomePanel.createOrShow(context.extensionUri), 500);
  }
}

export function deactivate(): void {}
