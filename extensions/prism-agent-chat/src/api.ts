import type { AgentEvent, ConnectionState } from './types';
import type { Event } from 'vscode';

/**
 * Public API exported by prism-agent-chat for other PRISM extensions.
 * Access via: vscode.extensions.getExtension('marc27.prism-agent-chat')?.exports
 */
export interface PrismAgentApi {
  /** Send a user message to the agent. */
  sendMessage(text: string): void;
  /** Subscribe to all agent events (text deltas, tool cards, turn complete, etc.). */
  onEvent: Event<AgentEvent>;
  /** Subscribe to connection state changes. */
  onStateChange: Event<ConnectionState>;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Ensure the agent is connected (no-op if already connected). */
  ensureConnected(): void;
}
