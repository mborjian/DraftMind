import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import type { AiChatMessage, AiGenerateRequest, AiGenerateResult } from './ai.types';

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
  providerType: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
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

@Injectable()
export class AiService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsService: SecretsService,
    private readonly logsService: LogsService,
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const provider = this.getProviderOrThrow(request.providerId);
    if (!provider.enabled) {
      throw new BadRequestException('The selected AI provider is disabled.');
    }

    const apiKey = this.secretsService.decrypt(provider.apiKeyEncrypted);
    if (!apiKey) {
      throw new BadRequestException('The selected AI provider does not have an API key configured.');
    }

    const requestBody = {
      model: provider.model,
      messages: request.messages,
      temperature: request.temperature ?? provider.temperature,
      max_tokens: request.maxTokens ?? provider.maxTokens,
      response_format: request.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    };

    const startedAt = Date.now();
    const endpoint = this.resolveChatCompletionsUrl(provider.baseUrl, provider.providerType);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown AI connectivity failure.';
      this.logsService.error(`AI request failed before completion for provider ${provider.name}: ${message}`, undefined, AiService.name);
      throw new BadGatewayException('The AI provider could not be reached.');
    });

    const latencyMs = Date.now() - startedAt;
    const rawText = await response.text();
    const responseJson = this.safeParseJson<OpenAiResponse>(rawText);

    if (!response.ok) {
      const providerMessage = this.extractProviderErrorMessage(responseJson, rawText);
      await this.logInvocation({
        request,
        provider,
        latencyMs,
        promptSnapshot: request.messages,
        responseSnapshot: responseJson ?? rawText,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      });
      throw new BadGatewayException(providerMessage);
    }

    const content = this.extractContent(responseJson);
    if (!content) {
      throw new BadGatewayException('The AI provider returned an empty response.');
    }

    const usage = responseJson?.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;
    const estimatedCost = this.extractEstimatedCost(responseJson);
    const model = responseJson?.model ?? provider.model;

    await this.logInvocation({
      request,
      provider,
      latencyMs,
      promptSnapshot: request.messages,
      responseSnapshot: responseJson ?? rawText,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    });

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

  private getProviderOrThrow(providerId: number): ResolvedAiProvider {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [providerId]);
    if (!provider) {
      throw new NotFoundException('The selected AI provider was not found.');
    }

    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKeyEncrypted: provider.apiKeyEncrypted,
      model: provider.model,
      enabled: Boolean(provider.enabled),
      timeoutSeconds: provider.timeoutSeconds,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
    };
  }

  private resolveChatCompletionsUrl(baseUrl: string, providerType: string): string {
    const normalized = baseUrl.replace(/\/+$/, '');
    if (normalized.endsWith('/chat/completions')) {
      return normalized;
    }
    if (normalized.endsWith('/v1')) {
      return `${normalized}/chat/completions`;
    }
    if (providerType === 'openai-compatible' || providerType === 'openrouter' || providerType === 'self-hosted') {
      return `${normalized}/v1/chat/completions`;
    }

    return normalized;
  }

  private extractContent(responseJson: OpenAiResponse | null): string {
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
      const errorRecord = responseJson as { error?: { message?: string } | string };
      if (typeof errorRecord.error === 'string') {
        return errorRecord.error;
      }
      if (errorRecord.error && typeof errorRecord.error === 'object' && typeof errorRecord.error.message === 'string') {
        return errorRecord.error.message;
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
