import * as vscode from 'vscode';
import { execFile, spawn, ChildProcess } from 'child_process';
import type { AgentEvent, ConnectionState } from './types';

/**
 * Spawns `prism backend` as a child process and communicates via JSON-RPC
 * over stdin/stdout — the exact same protocol the Ink TUI uses.
 *
 * This is NOT a separate service — it's one child process managed by
 * the extension, talking the same protocol as the TUI frontend.
 */
export class AgentClient {
	private process: ChildProcess | null = null;
	private _state: ConnectionState = 'disconnected';
	private buffer = '';
	private nextId = 1;

	private readonly _onEvent = new vscode.EventEmitter<AgentEvent>();
	readonly onEvent = this._onEvent.event;

	private readonly _onStateChange = new vscode.EventEmitter<ConnectionState>();
	readonly onStateChange = this._onStateChange.event;

	get state(): ConnectionState {
		return this._state;
	}

	connect(): void {
		if (this._state === 'connected' || this._state === 'connecting') {
			return;
		}

		this.setState('connecting');

		this._findPrismBinary((prismBin) => {
			if (!prismBin) {
				this.setState('error');
				vscode.window.showErrorMessage(
					'PRISM CLI not found. Install it with: curl -fsSL https://prism.marc27.com/install | sh'
				);
				return;
			}

			try {
				this.process = spawn(prismBin, ['backend'], {
					stdio: ['pipe', 'pipe', 'pipe'],
					env: { ...process.env },
				});

				this.process.stdout?.on('data', (chunk: Buffer) => {
					this.buffer += chunk.toString();
					this._processBuffer();
				});

				this.process.stderr?.on('data', (chunk: Buffer) => {
					const msg = chunk.toString().trim();
					if (msg) {
						console.log('[prism backend]', msg);
					}
				});

				this.process.on('error', (err) => {
					console.error('[prism backend] spawn error:', err.message);
					this.setState('error');
				});

				this.process.on('close', (code) => {
					console.log('[prism backend] exited with code', code);
					this.process = null;
					this.setState('disconnected');
				});

				this.setState('connected');
			} catch (err) {
				console.error('[prism backend] failed to spawn:', err);
				this.setState('error');
			}
		});
	}

	disconnect(): void {
		if (this.process) {
			this.process.stdin?.end();
			this.process.kill();
			this.process = null;
		}
		this.buffer = '';
		this.setState('disconnected');
	}

	sendMessage(text: string): void {
		this._sendRpc('input.message', { text });
	}

	sendApproval(callId: string, approved: boolean): void {
		this._sendRpc('input.prompt_response', {
			prompt_type: 'approval',
			response: approved ? 'y' : 'n',
		});
	}

	private _sendRpc(method: string, params: Record<string, unknown>): void {
		if (!this.process?.stdin?.writable) {
			return;
		}
		const msg = JSON.stringify({
			jsonrpc: '2.0',
			id: this.nextId++,
			method,
			params,
		});
		this.process.stdin.write(msg + '\n');
	}

	private _processBuffer(): void {
		const lines = this.buffer.split('\n');
		this.buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) { continue; }
			try {
				const msg = JSON.parse(trimmed);
				if (msg.method && !('id' in msg)) {
					this._onEvent.fire(this._parseEvent(msg));
				}
			} catch {
				// Not JSON — ignore
			}
		}
	}

	private _parseEvent(msg: { method: string; params?: Record<string, unknown> }): AgentEvent {
		const p = msg.params ?? {};
		const methodMap: Record<string, string> = {
			'ui.text.delta': 'text.delta',
			'ui.text.flush': 'text.flush',
			'ui.tool.start': 'tool.start',
			'ui.card': 'tool.result',
			'ui.prompt': 'tool.approval',
			'ui.cost': 'cost',
			'ui.turn.complete': 'turn.complete',
		};
		const type = methodMap[msg.method] ?? msg.method;

		if (msg.method === 'ui.card') {
			return {
				type: 'tool.result',
				call_id: (p.data as Record<string, unknown>)?.call_id as string || '',
				tool_name: p.tool_name as string || '',
				elapsed_ms: p.elapsed_ms as number || 0,
				success: p.card_type !== 'error',
				summary: p.content as string || '',
			} as AgentEvent;
		}

		if (msg.method === 'ui.prompt') {
			return {
				type: 'tool.approval',
				call_id: '',
				tool_name: p.tool_name as string || '',
				args: p.tool_args as Record<string, unknown> || {},
			} as AgentEvent;
		}

		return { type, ...p } as unknown as AgentEvent;
	}

	private _findPrismBinary(callback: (path: string | null) => void): void {
		const home = process.env['HOME'] || process.env['USERPROFILE'] || '';

		// Look inside the app bundle first (bundled binary), then system locations
		const candidates = [
			// Bundled inside the .app — this is the primary location
			`${process.execPath.replace(/\/[^/]+$/, '/../Resources/prism-bin/prism')}`,
			// Fallback to system installations
			`${home}/.prism/bin/prism`,
			`${home}/.cargo/bin/prism`,
			'/usr/local/bin/prism',
			'/opt/homebrew/bin/prism',
		];

		const tryNext = (i: number) => {
			if (i >= candidates.length) {
				callback(null);
				return;
			}
			execFile('/usr/bin/test', ['-x', candidates[i]], { timeout: 1000 }, (testErr) => {
				if (!testErr) {
					callback(candidates[i]);
				} else {
					tryNext(i + 1);
				}
			});
		};
		tryNext(0);
	}

	private setState(state: ConnectionState): void {
		if (this._state !== state) {
			this._state = state;
			this._onStateChange.fire(state);
		}
	}

	dispose(): void {
		this.disconnect();
		this._onEvent.dispose();
		this._onStateChange.dispose();
	}
}
