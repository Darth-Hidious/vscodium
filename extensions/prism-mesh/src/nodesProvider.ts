import * as vscode from 'vscode';

/** Shape returned by GET /api/mesh/nodes */
interface MeshNode {
	id: string;
	hostname: string;
	status: 'online' | 'busy' | 'offline';
	cpu_percent: number;
	ram_used_gb: number;
	ram_total_gb: number;
	gpu_count: number;
	jobs: NodeJob[];
}

interface NodeJob {
	id: string;
	name: string;
	status: string;
	duration_secs: number;
}

export class NodesProvider implements vscode.TreeDataProvider<NodeItem | NodeJobItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<NodeItem | NodeJobItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private _nodes: MeshNode[] = [];
	private _error: string | undefined;

	refresh(): void {
		this._fetchNodes();
	}

	getTreeItem(element: NodeItem | NodeJobItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: NodeItem | NodeJobItem): Promise<(NodeItem | NodeJobItem)[]> {
		if (element) {
			if (element instanceof NodeItem && element.jobs.length > 0) {
				return element.jobs.map(j => new NodeJobItem(j));
			}
			return [];
		}

		// Root level — fetch if we haven't yet
		if (this._nodes.length === 0 && this._error === undefined) {
			await this._fetchNodes();
		}

		if (this._error) {
			const item = new vscode.TreeItem(this._error) as NodeItem;
			item.iconPath = new vscode.ThemeIcon('warning');
			return [item as unknown as NodeItem];
		}

		if (this._nodes.length === 0) {
			const item = new vscode.TreeItem('No nodes found') as NodeItem;
			item.iconPath = new vscode.ThemeIcon('info');
			return [item as unknown as NodeItem];
		}

		return this._nodes.map(n => new NodeItem(n));
	}

	private async _fetchNodes(): Promise<void> {
		const url = this._getServerUrl() + '/api/mesh/nodes';
		try {
			const resp = await fetch(url);
			if (!resp.ok) {
				this._error = `Server error: ${resp.status}`;
				this._nodes = [];
			} else {
				const data = (await resp.json()) as { nodes: MeshNode[] } | MeshNode[];
				this._nodes = Array.isArray(data) ? data : data.nodes ?? [];
				this._error = undefined;
			}
		} catch {
			this._error = 'Not connected — check prism.mesh.serverUrl';
			this._nodes = [];
		}
		this._onDidChangeTreeData.fire();
	}

	private _getServerUrl(): string {
		return vscode.workspace.getConfiguration('prism.mesh').get<string>('serverUrl') ?? 'http://127.0.0.1:3100';
	}
}

const STATUS_ICONS: Record<string, vscode.ThemeIcon> = {
	online: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed')),
	busy: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconQueued')),
	offline: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed')),
};

export class NodeItem extends vscode.TreeItem {
	readonly nodeId: string;
	readonly jobs: NodeJob[];

	constructor(node: MeshNode) {
		const hasChildren = node.jobs && node.jobs.length > 0;
		super(
			node.hostname,
			hasChildren
				? vscode.TreeItemCollapsibleState.Collapsed
				: vscode.TreeItemCollapsibleState.None,
		);

		this.nodeId = node.id;
		this.jobs = node.jobs ?? [];
		this.description = `CPU: ${node.cpu_percent}% | RAM: ${node.ram_used_gb}/${node.ram_total_gb} GB | ${node.gpu_count} GPU`;
		this.iconPath = STATUS_ICONS[node.status] ?? STATUS_ICONS['offline'];
		this.contextValue = `node-${node.status}`;
		this.tooltip = new vscode.MarkdownString(
			`**${node.hostname}** (${node.status})\n\n` +
			`- CPU: ${node.cpu_percent}%\n` +
			`- RAM: ${node.ram_used_gb} / ${node.ram_total_gb} GB\n` +
			`- GPUs: ${node.gpu_count}\n` +
			`- Running jobs: ${this.jobs.length}`,
		);
	}
}

class NodeJobItem extends vscode.TreeItem {
	constructor(job: NodeJob) {
		super(job.name, vscode.TreeItemCollapsibleState.None);
		this.description = `${job.status} — ${formatDuration(job.duration_secs)}`;
		this.iconPath = new vscode.ThemeIcon('play');
		this.contextValue = 'node-job';
	}
}

function formatDuration(secs: number): string {
	if (secs < 60) {
		return `${secs}s`;
	}
	const mins = Math.floor(secs / 60);
	const remSecs = secs % 60;
	if (mins < 60) {
		return `${mins}m ${remSecs}s`;
	}
	const hours = Math.floor(mins / 60);
	const remMins = mins % 60;
	return `${hours}h ${remMins}m`;
}
