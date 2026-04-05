import * as vscode from 'vscode';
import { MarketplaceViewProvider } from './marketplacePanel';

export function activate(context: vscode.ExtensionContext): void {
	const provider = new MarketplaceViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MarketplaceViewProvider.viewType,
			provider,
			{ webviewOptions: { retainContextWhenHidden: true } }
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('prism.marketplace.open', () => {
			// Focus the marketplace sidebar
			vscode.commands.executeCommand('prism.marketplace.browse.focus');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('prism.marketplace.search', async () => {
			const query = await vscode.window.showInputBox({
				prompt: 'Search the MARC27 Marketplace',
				placeHolder: 'e.g. DFT, molecular dynamics, VASP workflow...'
			});
			if (query !== undefined) {
				provider.performSearch(query);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('prism.marketplace.install', async () => {
			const identifier = await vscode.window.showInputBox({
				prompt: 'Install from MARC27 Marketplace',
				placeHolder: 'Package identifier, e.g. marc27/vasp-workflow'
			});
			if (identifier) {
				provider.installPackage(identifier);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('prism.marketplace.refresh', () => {
			provider.refresh();
		})
	);
}

export function deactivate(): void {
	// nothing to dispose
}
