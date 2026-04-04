import * as vscode from 'vscode';
import { AuthService } from './authService';

let authService: AuthService;

export function activate(context: vscode.ExtensionContext): void {
  authService = new AuthService(context);

  // Status bar — shows login state
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, 999,
  );
  statusBarItem.command = 'prism.auth.login';
  context.subscriptions.push(statusBarItem);

  function updateStatusBar(): void {
    const session = authService.getSession();
    if (session) {
      statusBarItem.text = '$(account) ' + session.username;
      statusBarItem.tooltip = `Signed in as ${session.username} (${session.email})\nClick to manage account`;
      statusBarItem.command = 'prism.auth.status';
    } else {
      statusBarItem.text = '$(sign-in) Sign in to MARC27';
      statusBarItem.tooltip = 'Sign in to access marketplace, mesh, and billing';
      statusBarItem.command = 'prism.auth.login';
    }
    statusBarItem.show();
  }

  updateStatusBar();
  authService.onSessionChange(() => updateStatusBar());

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('prism.auth.login', async () => {
      await authService.login();
    }),

    vscode.commands.registerCommand('prism.auth.logout', async () => {
      await authService.logout();
      vscode.window.showInformationMessage('Signed out of MARC27.');
    }),

    vscode.commands.registerCommand('prism.auth.status', async () => {
      const session = authService.getSession();
      if (!session) {
        const action = await vscode.window.showInformationMessage(
          'Not signed in to MARC27.',
          'Sign In',
        );
        if (action === 'Sign In') {
          await authService.login();
        }
        return;
      }

      const action = await vscode.window.showInformationMessage(
        `Signed in as ${session.username} (${session.email})\nOrg: ${session.org || 'Personal'}`,
        'Sign Out',
      );
      if (action === 'Sign Out') {
        await authService.logout();
      }
    }),
  );

  // Prompt login on first startup if not authenticated
  if (!authService.getSession()) {
    globalThis.setTimeout(async () => {
      const action = await vscode.window.showInformationMessage(
        'Sign in to MARC27 to access the marketplace, mesh computing, and billing.',
        'Sign In',
        'Later',
      );
      if (action === 'Sign In') {
        await authService.login();
      }
    }, 2000);
  }
}

export function deactivate(): void {}
