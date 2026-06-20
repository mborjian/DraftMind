export type AiRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiRole;
  content: string;
}

export interface AiGenerateRequest {
  providerId: number;
  model?: string | null;
  purpose: string;
  messages: AiChatMessage[];
  workflowId?: number | null;
  executionId?: number | null;
  responseFormat?: 'text' | 'json_object';
  temperature?: number;
  maxTokens?: number;
}

export interface AiGenerateResult {
  providerId: number;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  rawResponse: unknown;
}
