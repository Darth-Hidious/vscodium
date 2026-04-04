import * as vscode from 'vscode';
import type { AgentEvent, ConnectionState } from './types';

/**
 * WebSocket client that connects to the PRISM agent server.
 * Uses vscode's built-in fetch for HTTP, and raw TCP isn't needed —
 * we poll via HTTP SSE or use the VS Code proposed API for WebSocket.
 * For now, uses a simple HTTP polling approach that works everywhere.
 */
export class AgentClient {
  private _state: ConnectionState = 'disconnected';
  private pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private sessionId = '';

  private readonly _onEvent = new vscode.EventEmitter<AgentEvent>();
  readonly onEvent = this._onEvent.event;

  private readonly _onStateChange = new vscode.EventEmitter<ConnectionState>();
  readonly onStateChange = this._onStateChange.event;

  get state(): ConnectionState {
    return this._state;
  }

  connect(): void {
    if (this._state === 'connecting' || this._state === 'connected') {
      return;
    }
    this.setState('connecting');

    const config = vscode.workspace.getConfiguration('prism.agent');
    const serverUrl = config.get<string>('serverUrl', 'http://127.0.0.1:3100');
    const autoApprove = config.get<boolean>('autoApprove', false);

    // Init session
    this.doPost(`${serverUrl}/api/agent/init`, { auto_approve: autoApprove })
      .then((resp: Record<string, unknown>) => {
        this.sessionId = resp.session_id as string || '';
        this.setState('connected');
      })
      .catch(() => {
        this.setState('error');
      });
  }

  disconnect(): void {
    if (this.pollTimer) {
      globalThis.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.sessionId = '';
    this.setState('disconnected');
  }

  sendMessage(text: string): void {
    const config = vscode.workspace.getConfiguration('prism.agent');
    const serverUrl = config.get<string>('serverUrl', 'http://127.0.0.1:3100');

    this.doPost(`${serverUrl}/api/agent/message`, {
      session_id: this.sessionId,
      text,
    }).then((resp: Record<string, unknown>) => {
      const events = resp.events as AgentEvent[] | undefined;
      if (events) {
        for (const event of events) {
          this._onEvent.fire(event);
        }
      }
    }).catch(() => {
      this._onEvent.fire({ type: 'error', message: 'Failed to send message' });
    });
  }

  sendApproval(callId: string, approved: boolean): void {
    const config = vscode.workspace.getConfiguration('prism.agent');
    const serverUrl = config.get<string>('serverUrl', 'http://127.0.0.1:3100');

    this.doPost(`${serverUrl}/api/agent/approval`, {
      session_id: this.sessionId,
      call_id: callId,
      approved,
    }).catch(() => {
      // silently fail
    });
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this._onStateChange.fire(state);
    }
  }

  private async doPost(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return await resp.json() as Record<string, unknown>;
  }

  dispose(): void {
    this.disconnect();
    this._onEvent.dispose();
    this._onStateChange.dispose();
  }
}
