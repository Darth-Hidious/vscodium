import * as vscode from 'vscode';
import { NodesProvider, NodeItem } from './nodesProvider';
import { JobsProvider, JobItem } from './jobsProvider';

export function activate(context: vscode.ExtensionContext): void {
	const nodesProvider = new NodesProvider();
	const jobsProvider = new JobsProvider();

	const nodesTreeView = vscode.window.createTreeView('prism.mesh.nodes', {
		treeDataProvider: nodesProvider,
		showCollapseAll: true,
	});

	const jobsTreeView = vscode.window.createTreeView('prism.mesh.jobs', {
		treeDataProvider: jobsProvider,
		showCollapseAll: true,
	});

	// Auto-refresh every 10 seconds when views are visible
	let refreshTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

	function startAutoRefresh(): void {
		stopAutoRefresh();
		refreshTimer = globalThis.setTimeout(function tick() {
			if (nodesTreeView.visible || jobsTreeView.visible) {
				nodesProvider.refresh();
				jobsProvider.refresh();
			}
			refreshTimer = globalThis.setTimeout(tick, 10_000);
		}, 10_000);
	}

	function stopAutoRefresh(): void {
		if (refreshTimer !== undefined) {
			clearTimeout(refreshTimer);
			refreshTimer = undefined;
		}
	}

	nodesTreeView.onDidChangeVisibility(() => {
		if (nodesTreeView.visible || jobsTreeView.visible) {
			startAutoRefresh();
		} else if (!nodesTreeView.visible && !jobsTreeView.visible) {
			stopAutoRefresh();
		}
	});

	jobsTreeView.onDidChangeVisibility(() => {
		if (nodesTreeView.visible || jobsTreeView.visible) {
			startAutoRefresh();
		} else if (!nodesTreeView.visible && !jobsTreeView.visible) {
			stopAutoRefresh();
		}
	});

	startAutoRefresh();

	// Commands
	context.subscriptions.push(
		nodesTreeView,
		jobsTreeView,

		vscode.commands.registerCommand('prism.mesh.refresh', () => {
			nodesProvider.refresh();
			jobsProvider.refresh();
		}),

		vscode.commands.registerCommand('prism.mesh.nodeUp', async (item?: NodeItem) => {
			const nodeId = item?.nodeId;
			if (!nodeId) {
				return;
			}
			try {
				await meshPost('/api/mesh/nodes/up', { node_id: nodeId });
				vscode.window.showInformationMessage(`Node ${item.label} brought up.`);
				nodesProvider.refresh();
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to bring node up: ${String(err)}`);
			}
		}),

		vscode.commands.registerCommand('prism.mesh.nodeDown', async (item?: NodeItem) => {
			const nodeId = item?.nodeId;
			if (!nodeId) {
				return;
			}
			const confirm = await vscode.window.showWarningMessage(
				`Take node ${item.label} down?`, { modal: true }, 'Yes'
			);
			if (confirm !== 'Yes') {
				return;
			}
			try {
				await meshPost('/api/mesh/nodes/down', { node_id: nodeId });
				vscode.window.showInformationMessage(`Node ${item.label} taken down.`);
				nodesProvider.refresh();
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to take node down: ${String(err)}`);
			}
		}),

		vscode.commands.registerCommand('prism.mesh.discover', async () => {
			try {
				await meshPost('/api/mesh/discover', {});
				vscode.window.showInformationMessage('Mesh peer discovery initiated.');
				nodesProvider.refresh();
			} catch (err) {
				vscode.window.showErrorMessage(`Discovery failed: ${String(err)}`);
			}
		}),

		vscode.commands.registerCommand('prism.mesh.jobCancel', async (item?: JobItem) => {
			const jobId = item?.jobId;
			if (!jobId) {
				return;
			}
			const confirm = await vscode.window.showWarningMessage(
				`Cancel job ${item.label}?`, { modal: true }, 'Yes'
			);
			if (confirm !== 'Yes') {
				return;
			}
			try {
				await meshPost('/api/jobs/cancel', { job_id: jobId });
				vscode.window.showInformationMessage(`Job ${item.label} cancelled.`);
				jobsProvider.refresh();
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to cancel job: ${String(err)}`);
			}
		}),

		vscode.commands.registerCommand('prism.mesh.jobRetry', async (item?: JobItem) => {
			const jobId = item?.jobId;
			if (!jobId) {
				return;
			}
			try {
				await meshPost('/api/jobs/retry', { job_id: jobId });
				vscode.window.showInformationMessage(`Job ${item.label} retried.`);
				jobsProvider.refresh();
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to retry job: ${String(err)}`);
			}
		}),

		{ dispose: stopAutoRefresh },
	);
}

export function deactivate(): void { }

function getServerUrl(): string {
	return vscode.workspace.getConfiguration('prism.mesh').get<string>('serverUrl') ?? 'http://127.0.0.1:3100';
}

async function meshPost(path: string, body: Record<string, unknown>): Promise<unknown> {
	const url = getServerUrl() + path;
	const resp = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`${resp.status}: ${text}`);
	}
	return resp.json();
}
