import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import type { AiChatMessage, AiGenerateRequest, AiGenerateResult } from './ai.types';

type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openai-compatible'
  | 'lm-studio'
  | 'ollama';

interface AiProviderRow {
  id: number;
  name: string;
  providerType: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
  model: string;
  enabled: number;
  timeoutSeconds: number;
  maxTokens: number;
  temperature: number;
}

interface ResolvedAiProvider {
  id: number;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  timeoutSeconds: number;
  maxTokens: number;
  temperature: number;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  cost?: number;
}

interface OpenAiResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: OpenAiUsage;
  cost?: number;
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class AiService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsService: SecretsService,
    private readonly logsService: LogsService,
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const provider = this.getProviderOrThrow(request.providerId, request.model);
    if (!provider.enabled) {
      throw new BadRequestException('The selected AI provider is disabled.');
    }

    if (this.requiresApiKey(provider.providerType) && !provider.apiKey) {
      throw new BadRequestException('The selected AI provider does not have an API key configured.');
    }

    const startedAt = Date.now();

    try {
      const response = await this.performRequest(provider, request);
      const latencyMs = Date.now() - startedAt;
      const result = this.normalizeResponse(provider, response, request, latencyMs);

      await this.logInvocation({
        request,
        provider,
        latencyMs,
        promptSnapshot: request.messages,
        responseSnapshot: result.rawResponse,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        estimatedCost: result.estimatedCost,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'Unknown AI connectivity failure.';
      this.logsService.error(`AI request failed for provider ${provider.name}: ${message}`, undefined, AiService.name);
      throw error instanceof BadGatewayException ? error : new BadGatewayException(message);
    }
  }

  private getProviderOrThrow(providerId: number, workflowModel?: string | null): ResolvedAiProvider {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [providerId]);
    if (!provider) {
      throw new NotFoundException('The selected AI provider was not found.');
    }

    return {
      id: provider.id,
      name: provider.name,
      providerType: this.normalizeProviderType(provider.providerType),
      baseUrl: provider.baseUrl,
      apiKey: this.secretsService.decrypt(provider.apiKeyEncrypted),
      model: workflowModel?.trim() || provider.model,
      enabled: Boolean(provider.enabled),
      timeoutSeconds: provider.timeoutSeconds,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
    };
  }

  private async performRequest(provider: ResolvedAiProvider, request: AiGenerateRequest) {
    if (provider.providerType === 'anthropic') {
      return this.performAnthropicRequest(provider, request);
    }
    if (provider.providerType === 'gemini') {
      return this.performGeminiRequest(provider, request);
    }
    if (provider.providerType === 'ollama') {
      return this.performOllamaRequest(provider, request);
    }

    return this.performOpenAiCompatibleRequest(provider, request);
  }

  private async performOpenAiCompatibleRequest(provider: ResolvedAiProvider, request: AiGenerateRequest) {
    const requestBody = {
      model: provider.model,
      messages: request.messages,
      temperature: request.temperature ?? provider.temperature,
      max_tokens: request.maxTokens ?? provider.maxTokens,
      response_format: request.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    };

    const endpoint = this.resolveOpenAiChatCompletionsUrl(provider.baseUrl);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
    });

    const rawText = await response.text();
    const responseJson = this.safeParseJson<OpenAiResponse>(rawText);
    return { response, responseJson, rawText, kind: 'openai-compatible' as const };
  }

  private async performAnthropicRequest(provider: ResolvedAiProvider, request: AiGenerateRequest) {
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
      .trim();
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }));

    const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': provider.apiKey ?? '',
      },
      body: JSON.stringify({
        model: provider.model,
        system: system || undefined,
        messages,
        max_tokens: request.maxTokens ?? provider.maxTokens,
        temperature: request.temperature ?? provider.temperature,
      }),
      signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
    });

    const rawText = await response.text();
    const responseJson = this.safeParseJson<AnthropicResponse>(rawText);
    return { response, responseJson, rawText, kind: 'anthropic' as const };
  }

  private async performGeminiRequest(provider: ResolvedAiProvider, request: AiGenerateRequest) {
    const systemInstruction = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
      .trim();
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const response = await fetch(
      `${provider.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey ?? '')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          contents,
          system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: request.temperature ?? provider.temperature,
            maxOutputTokens: request.maxTokens ?? provider.maxTokens,
            responseMimeType: request.responseFormat === 'json_object' ? 'application/json' : 'text/plain',
          },
        }),
        signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
      },
    );

    const rawText = await response.text();
    const responseJson = this.safeParseJson<GeminiResponse>(rawText);
    return { response, responseJson, rawText, kind: 'gemini' as const };
  }

  private async performOllamaRequest(provider: ResolvedAiProvider, request: AiGenerateRequest) {
    const messages = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: false,
        format: request.responseFormat === 'json_object' ? 'json' : undefined,
        options: {
          temperature: request.temperature ?? provider.temperature,
          num_predict: request.maxTokens ?? provider.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
    });

    const rawText = await response.text();
    const responseJson = this.safeParseJson<{
      model?: string;
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      error?: string;
    }>(rawText);
    return { response, responseJson, rawText, kind: 'ollama' as const };
  }

  private normalizeResponse(
    provider: ResolvedAiProvider,
    responseData:
      | { response: Response; responseJson: OpenAiResponse | null; rawText: string; kind: 'openai-compatible' }
      | { response: Response; responseJson: AnthropicResponse | null; rawText: string; kind: 'anthropic' }
      | { response: Response; responseJson: GeminiResponse | null; rawText: string; kind: 'gemini' }
      | {
          response: Response;
          responseJson: {
            model?: string;
            message?: { content?: string };
            prompt_eval_count?: number;
            eval_count?: number;
            error?: string;
          } | null;
          rawText: string;
          kind: 'ollama';
        },
    request: AiGenerateRequest,
    latencyMs: number,
  ): AiGenerateResult {
    const { response, rawText } = responseData;

    if (!response.ok) {
      throw new BadGatewayException(this.extractProviderErrorMessage(responseData.responseJson, rawText));
    }

    if (responseData.kind === 'anthropic') {
      const content = (responseData.responseJson?.content ?? [])
        .map((segment) => segment.text ?? '')
        .join('')
        .trim();
      if (!content) {
        throw new BadGatewayException('The AI provider returned an empty response.');
      }

      const inputTokens = responseData.responseJson?.usage?.input_tokens ?? 0;
      const outputTokens = responseData.responseJson?.usage?.output_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;

      return {
        providerId: provider.id,
        model: responseData.responseJson?.model ?? provider.model,
        content,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: 0,
        latencyMs,
        rawResponse: responseData.responseJson ?? rawText,
      };
    }

    if (responseData.kind === 'gemini') {
      const content = (responseData.responseJson?.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!content) {
        throw new BadGatewayException('The AI provider returned an empty response.');
      }

      const usage = responseData.responseJson?.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;
      const totalTokens = usage?.totalTokenCount ?? inputTokens + outputTokens;

      return {
        providerId: provider.id,
        model: responseData.responseJson?.modelVersion ?? provider.model,
        content,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: 0,
        latencyMs,
        rawResponse: responseData.responseJson ?? rawText,
      };
    }

    if (responseData.kind === 'ollama') {
      const content = responseData.responseJson?.message?.content?.trim() ?? '';
      if (!content) {
        throw new BadGatewayException('The AI provider returned an empty response.');
      }

      const inputTokens = responseData.responseJson?.prompt_eval_count ?? 0;
      const outputTokens = responseData.responseJson?.eval_count ?? 0;
      const totalTokens = inputTokens + outputTokens;

      return {
        providerId: provider.id,
        model: responseData.responseJson?.model ?? provider.model,
        content,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: 0,
        latencyMs,
        rawResponse: responseData.responseJson ?? rawText,
      };
    }

    const responseJson = responseData.responseJson;
    const content = this.extractOpenAiContent(responseJson);
    if (!content) {
      throw new BadGatewayException('The AI provider returned an empty response.');
    }

    const usage = responseJson?.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;
    const estimatedCost = this.extractEstimatedCost(responseJson);
    const model = responseJson?.model ?? provider.model;

    return {
      providerId: provider.id,
      model,
      content,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      latencyMs,
      rawResponse: responseJson ?? rawText,
    };
  }

  private resolveOpenAiChatCompletionsUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/+$/, '');
    if (normalized.endsWith('/chat/completions')) {
      return normalized;
    }
    if (normalized.endsWith('/v1')) {
      return `${normalized}/chat/completions`;
    }
    return `${normalized}/v1/chat/completions`;
  }

  private extractOpenAiContent(responseJson: OpenAiResponse | null): string {
    const firstChoice = responseJson?.choices?.[0]?.message?.content;
    if (typeof firstChoice === 'string') {
      return firstChoice.trim();
    }

    if (Array.isArray(firstChoice)) {
      return firstChoice
        .map((segment) => segment.text ?? '')
        .join('')
        .trim();
    }

    return '';
  }

  private extractEstimatedCost(responseJson: OpenAiResponse | null): number {
    if (typeof responseJson?.usage?.estimated_cost === 'number') {
      return responseJson.usage.estimated_cost;
    }
    if (typeof responseJson?.usage?.cost === 'number') {
      return responseJson.usage.cost;
    }
    if (typeof responseJson?.cost === 'number') {
      return responseJson.cost;
    }
    return 0;
  }

  private extractProviderErrorMessage(responseJson: unknown, rawText: string): string {
    if (responseJson && typeof responseJson === 'object') {
      const record = responseJson as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof record.error === 'string') {
        return record.error;
      }
      if (record.error && typeof record.error === 'object' && typeof record.error.message === 'string') {
        return record.error.message;
      }
      if (typeof record.message === 'string') {
        return record.message;
      }
    }

    return rawText.slice(0, 240) || 'The AI provider rejected the request.';
  }

  private safeParseJson<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private requiresApiKey(providerType: ProviderType): boolean {
    return providerType === 'openai' || providerType === 'anthropic' || providerType === 'gemini';
  }

  private normalizeProviderType(value: string): ProviderType {
    const normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'openai':
      case 'anthropic':
      case 'gemini':
      case 'openai-compatible':
      case 'lm-studio':
      case 'ollama':
        return normalized;
      case 'openrouter':
      case 'self-hosted':
        return 'openai-compatible';
      default:
        throw new BadRequestException('Unsupported provider type.');
    }
  }

  private async logInvocation(input: {
    request: AiGenerateRequest;
    provider: ResolvedAiProvider;
    latencyMs: number;
    promptSnapshot: AiChatMessage[];
    responseSnapshot: unknown;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    const prompt = JSON.stringify(input.promptSnapshot).slice(0, 120000);
    const response = JSON.stringify(input.responseSnapshot).slice(0, 120000);

    this.databaseService.transaction(() => {
      this.databaseService.run(
        `INSERT INTO AIRequestLog (
          executionId, workflowId, providerId, purpose, model, prompt, response,
          inputTokens, outputTokens, totalTokens, estimatedCost, latencyMs, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.request.executionId ?? null,
          input.request.workflowId ?? null,
          input.provider.id,
          input.request.purpose,
          input.model,
          prompt,
          response,
          input.inputTokens,
          input.outputTokens,
          input.totalTokens,
          input.estimatedCost,
          input.latencyMs,
          createdAt,
        ],
      );

      if (input.request.executionId) {
        this.databaseService.run(
          `UPDATE WorkflowExecution
           SET totalTokens = totalTokens + ?, estimatedCost = estimatedCost + ?
           WHERE id = ?`,
          [input.totalTokens, input.estimatedCost, input.request.executionId],
        );
      }
    });
  }
}
