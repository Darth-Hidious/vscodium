import * as vscode from 'vscode';
import type { AgentEvent, ConnectionState } from './types';

/**
 * WebSocket client that connects to the PRISM agent server.
 * Receives streaming agent events and sends user commands.
 */
export class AgentClient {
  private ws: WebSocket | null = null;
  private _state: ConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

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

    const config = vscode.workspace.getConfiguration('prism.agent');
    const url = config.get<string>('serverUrl', 'ws://127.0.0.1:3100/ws/agent');

    this.setState('connecting');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setState('connected');
        this.reconnectDelay = 1000;

        // Send init
        const autoApprove = config.get<boolean>('autoApprove', false);
        const model = config.get<string>('model', '');
        this.send({
          jsonrpc: '2.0',
          method: 'init',
          params: { auto_approve: autoApprove, ...(model ? { model } : {}) },
          id: 1,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          // JSON-RPC notification (no id) = agent event
          if (data.method && !('id' in data)) {
            this._onEvent.fire(this.parseEvent(data));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setState('error');
        this.ws?.close();
      };
    } catch {
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
  }

  sendMessage(text: string): void {
    this.send({
      jsonrpc: '2.0',
      method: 'input.message',
      params: { text },
    });
  }

  sendApproval(callId: string, approved: boolean): void {
    this.send({
      jsonrpc: '2.0',
      method: 'input.approval',
      params: { call_id: callId, approved },
    });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this._onStateChange.fire(state);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) { return; }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  private parseEvent(data: { method: string; params?: Record<string, unknown> }): AgentEvent {
    const p = data.params ?? {};
    // Map JSON-RPC method names to our event types
    const methodMap: Record<string, string> = {
      'ui.text.delta': 'text.delta',
      'ui.text.flush': 'text.flush',
      'ui.tool.start': 'tool.start',
      'ui.tool.result': 'tool.result',
      'ui.tool.approval': 'tool.approval',
      'ui.plan': 'plan',
      'ui.cost': 'cost',
      'ui.turn.complete': 'turn.complete',
      'ui.error': 'error',
    };
    const type = methodMap[data.method] ?? data.method;
    return { type, ...p } as unknown as AgentEvent;
  }

  dispose(): void {
    this.disconnect();
    this._onEvent.dispose();
    this._onStateChange.dispose();
  }
}
