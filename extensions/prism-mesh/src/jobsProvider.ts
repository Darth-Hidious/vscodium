import * as vscode from 'vscode';

/** Shape returned by GET /api/jobs */
interface Job {
	id: string;
	name: string;
	status: 'running' | 'queued' | 'completed' | 'failed';
	duration_secs: number;
	node: string;
}

type JobCategory = 'Running' | 'Queued' | 'Recent';

export class JobsProvider implements vscode.TreeDataProvider<JobCategoryItem | JobItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<JobCategoryItem | JobItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private _jobs: Job[] = [];
	private _error: string | undefined;

	refresh(): void {
		this._fetchJobs();
	}

	getTreeItem(element: JobCategoryItem | JobItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: JobCategoryItem | JobItem): Promise<(JobCategoryItem | JobItem)[]> {
		if (element instanceof JobItem) {
			return [];
		}

		if (element instanceof JobCategoryItem) {
			return element.children;
		}

		// Root level
		if (this._jobs.length === 0 && this._error === undefined) {
			await this._fetchJobs();
		}

		if (this._error) {
			const item = new vscode.TreeItem(this._error) as unknown as JobCategoryItem;
			(item as vscode.TreeItem).iconPath = new vscode.ThemeIcon('warning');
			return [item];
		}

		const running = this._jobs.filter(j => j.status === 'running');
		const queued = this._jobs.filter(j => j.status === 'queued');
		const recent = this._jobs
			.filter(j => j.status === 'completed' || j.status === 'failed')
			.slice(0, 10);

		const categories: JobCategoryItem[] = [];

		if (running.length > 0) {
			categories.push(new JobCategoryItem('Running', running, 'play-circle'));
		}
		if (queued.length > 0) {
			categories.push(new JobCategoryItem('Queued', queued, 'clock'));
		}
		if (recent.length > 0) {
			categories.push(new JobCategoryItem('Recent', recent, 'history'));
		}

		if (categories.length === 0) {
			const item = new vscode.TreeItem('No jobs') as unknown as JobCategoryItem;
			(item as vscode.TreeItem).iconPath = new vscode.ThemeIcon('info');
			return [item];
		}

		return categories;
	}

	private async _fetchJobs(): Promise<void> {
		const url = this._getServerUrl() + '/api/jobs';
		try {
			const resp = await fetch(url);
			if (!resp.ok) {
				this._error = `Server error: ${resp.status}`;
				this._jobs = [];
			} else {
				const data = (await resp.json()) as { jobs: Job[] } | Job[];
				this._jobs = Array.isArray(data) ? data : data.jobs ?? [];
				this._error = undefined;
			}
		} catch {
			this._error = 'Not connected — check prism.mesh.serverUrl';
			this._jobs = [];
		}
		this._onDidChangeTreeData.fire();
	}

	private _getServerUrl(): string {
		return vscode.workspace.getConfiguration('prism.mesh').get<string>('serverUrl') ?? 'http://127.0.0.1:3100';
	}
}

const STATUS_ICONS: Record<string, vscode.ThemeIcon> = {
	running: new vscode.ThemeIcon('sync~spin'),
	queued: new vscode.ThemeIcon('watch'),
	completed: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')),
	failed: new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')),
};

class JobCategoryItem extends vscode.TreeItem {
	readonly children: JobItem[];

	constructor(category: JobCategory, jobs: Job[], icon: string) {
		super(
			`${category} (${jobs.length})`,
			vscode.TreeItemCollapsibleState.Expanded,
		);
		this.iconPath = new vscode.ThemeIcon(icon);
		this.contextValue = 'job-category';
		this.children = jobs.map(j => new JobItem(j));
	}
}

export class JobItem extends vscode.TreeItem {
	readonly jobId: string;

	constructor(job: Job) {
		super(job.name, vscode.TreeItemCollapsibleState.None);
		this.jobId = job.id;
		this.description = `${job.status} — ${formatDuration(job.duration_secs)} — ${job.node}`;
		this.iconPath = STATUS_ICONS[job.status] ?? new vscode.ThemeIcon('question');
		this.contextValue = `job-${job.status}`;
		this.tooltip = new vscode.MarkdownString(
			`**${job.name}**\n\n` +
			`- Status: ${job.status}\n` +
			`- Duration: ${formatDuration(job.duration_secs)}\n` +
			`- Node: ${job.node}\n` +
			`- ID: \`${job.id}\``,
		);
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
