import * as vscode from 'vscode';
import { AuthService } from './authService';

let authService: AuthService;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  authService = new AuthService();

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  authService.onSessionChange(() => updateStatusBar());

  context.subscriptions.push(
    vscode.commands.registerCommand('prism.auth.login', () => authService.login()),
    vscode.commands.registerCommand('prism.auth.logout', () => authService.logout()),
    vscode.commands.registerCommand('prism.auth.status', () => {
      const session = authService.getSession();
      if (session) {
        vscode.window.showInformationMessage(
          `Signed in as ${session.username}${session.org ? ' (' + session.org + ')' : ''}`
        );
      } else {
        vscode.window.showInformationMessage('Not signed in. Run `prism login` to authenticate.');
      }
    }),
    vscode.commands.registerCommand('prism.auth.refresh', () => authService.refresh()),
    { dispose: () => authService.dispose() },
  );

  const refreshTimer = setInterval(() => authService.refresh(), 60000);
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
}

function updateStatusBar(): void {
  const session = authService.getSession();
  if (session) {
    statusBarItem.text = `$(account) ${session.username}`;
    statusBarItem.tooltip = `Signed in as ${session.username}${session.org ? '\nOrg: ' + session.org : ''}`;
    statusBarItem.command = 'prism.auth.status';
  } else {
    statusBarItem.text = '$(sign-in) Sign in';
    statusBarItem.tooltip = 'Sign in to MARC27';
    statusBarItem.command = 'prism.auth.login';
  }
  statusBarItem.show();
}

export function deactivate(): void {
  authService?.dispose();
}
