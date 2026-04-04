/**
 * Wire types for PRISM agent communication.
 * Mirrors prism-proto and prism-ipc JSON-RPC messages.
 */

// --- Agent → Client (events) ---

export interface TextDelta {
  type: 'text.delta';
  text: string;
}

export interface TextFlush {
  type: 'text.flush';
  text: string;
}

export interface ToolCallStart {
  type: 'tool.start';
  tool_name: string;
  call_id: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  type: 'tool.result';
  call_id: string;
  tool_name: string;
  elapsed_ms: number;
  success: boolean;
  summary: string;
  data?: unknown;
}

export interface ToolApprovalRequest {
  type: 'tool.approval';
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
}

export interface PlanCard {
  type: 'plan';
  steps: string[];
}

export interface CostUpdate {
  type: 'cost';
  input_tokens: number;
  output_tokens: number;
  turn_cost: number;
  session_cost: number;
}

export interface TurnComplete {
  type: 'turn.complete';
}

export interface AgentError {
  type: 'error';
  message: string;
}

export type AgentEvent =
  | TextDelta
  | TextFlush
  | ToolCallStart
  | ToolCallResult
  | ToolApprovalRequest
  | PlanCard
  | CostUpdate
  | TurnComplete
  | AgentError;

// --- Client → Agent (commands) ---

export interface SendMessage {
  method: 'input.message';
  params: { text: string };
}

export interface ApprovalResponse {
  method: 'input.approval';
  params: { call_id: string; approved: boolean };
}

export interface InitSession {
  method: 'init';
  params: { auto_approve?: boolean; model?: string };
}

export type AgentCommand = SendMessage | ApprovalResponse | InitSession;

// --- Connection state ---

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
