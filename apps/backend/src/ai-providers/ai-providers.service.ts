import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

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
  createdAt: string;
  updatedAt: string;
}

interface ProviderProbeInput {
  providerType: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutSeconds?: number;
}

interface ProviderConfig {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string | null;
  timeoutSeconds: number;
}

interface ProviderResponseSummary {
  success: boolean;
  statusCode: number;
  models: string[];
  error?: string;
}

const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; requiresApiKey: boolean }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    requiresApiKey: true,
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
  },
  'openai-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: false,
  },
  'lm-studio': {
    baseUrl: 'http://localhost:1234',
    requiresApiKey: false,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
  },
};

@Injectable()
export class AiProvidersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsService: SecretsService,
  ) {}

  listProviders() {
    return this.databaseService.all<Omit<AiProviderRow, 'apiKeyEncrypted'> & { hasApiKey: number }>(
      `SELECT id, name, providerType, baseUrl, model, enabled, timeoutSeconds, maxTokens,
        temperature, createdAt, updatedAt,
        CASE WHEN apiKeyEncrypted IS NULL THEN 0 ELSE 1 END AS hasApiKey
       FROM AIProvider ORDER BY name ASC`,
    );
  }

  getProvider(id: number) {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [id]);
    if (!provider) {
      throw new NotFoundException('AI provider was not found.');
    }

    return this.serialize(provider);
  }

  createProvider(dto: CreateAiProviderDto) {
    const normalized = this.normalizeProviderInput(dto);
    const now = new Date().toISOString();
    const result = this.databaseService.run(
      `INSERT INTO AIProvider (
        name, providerType, baseUrl, apiKeyEncrypted, model, enabled, timeoutSeconds,
        maxTokens, temperature, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.name,
        normalized.providerType,
        normalized.baseUrl,
        normalized.apiKey ? this.secretsService.encrypt(normalized.apiKey) : null,
        normalized.model,
        normalized.enabled === false ? 0 : 1,
        normalized.timeoutSeconds ?? 60,
        normalized.maxTokens ?? 2048,
        normalized.temperature ?? 0.4,
        now,
        now,
      ],
    );

    return this.getProvider(result.lastInsertRowid);
  }

  updateProvider(id: number, dto: UpdateAiProviderDto) {
    const current = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [id]);
    if (!current) {
      throw new NotFoundException('AI provider was not found.');
    }

    const normalized = this.normalizeProviderInput({
      name: dto.name ?? current.name,
      providerType: dto.providerType ?? current.providerType,
      baseUrl: dto.baseUrl ?? current.baseUrl,
      model: dto.model ?? current.model,
      apiKey: dto.apiKey,
      enabled: dto.enabled ?? Boolean(current.enabled),
      timeoutSeconds: dto.timeoutSeconds ?? current.timeoutSeconds,
      maxTokens: dto.maxTokens ?? current.maxTokens,
      temperature: dto.temperature ?? current.temperature,
    });

    this.databaseService.run(
      `UPDATE AIProvider SET
        name = ?, providerType = ?, baseUrl = ?, apiKeyEncrypted = ?, model = ?, enabled = ?,
        timeoutSeconds = ?, maxTokens = ?, temperature = ?, updatedAt = ?
       WHERE id = ?`,
      [
        normalized.name,
        normalized.providerType,
        normalized.baseUrl,
        dto.apiKey === undefined ? current.apiKeyEncrypted : normalized.apiKey ? this.secretsService.encrypt(normalized.apiKey) : null,
        normalized.model,
        normalized.enabled === false ? 0 : 1,
        normalized.timeoutSeconds ?? current.timeoutSeconds,
        normalized.maxTokens ?? current.maxTokens,
        normalized.temperature ?? current.temperature,
        new Date().toISOString(),
        id,
      ],
    );

    return this.getProvider(id);
  }

  deleteProvider(id: number) {
    const provider = this.getProvider(id);
    this.databaseService.run('UPDATE AIProvider SET enabled = 0, updatedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
    return provider;
  }

  async testProvider(id: number) {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [id]);
    if (!provider) {
      throw new NotFoundException('AI provider was not found.');
    }

    const apiKey = this.secretsService.decrypt(provider.apiKeyEncrypted);
    const summary = await this.probeProviderInternal({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: apiKey ?? undefined,
      timeoutSeconds: provider.timeoutSeconds,
    });

    return {
      ...summary,
      provider: this.serialize(provider),
    };
  }

  async listModelsForProvider(id: number) {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [id]);
    if (!provider) {
      throw new NotFoundException('AI provider was not found.');
    }

    const apiKey = this.secretsService.decrypt(provider.apiKeyEncrypted);
    const summary = await this.probeProviderInternal({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: apiKey ?? undefined,
      timeoutSeconds: provider.timeoutSeconds,
    });
    return summary.models;
  }

  async probeProvider(input: ProviderProbeInput) {
    return this.probeProviderInternal(input);
  }

  getResolvedProviderConfig(input: {
    providerType: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    timeoutSeconds?: number;
  }): ProviderConfig {
    const providerType = this.normalizeProviderType(input.providerType);
    const defaults = PROVIDER_DEFAULTS[providerType];
    const baseUrl = this.normalizeBaseUrl(input.baseUrl?.trim() || defaults.baseUrl, providerType);
    const apiKey = input.apiKey?.trim() || null;
    const timeoutSeconds = input.timeoutSeconds ?? 60;

    if (defaults.requiresApiKey && !apiKey) {
      throw new BadRequestException('Provider API key is required for the selected provider.');
    }

    return {
      providerType,
      baseUrl,
      apiKey,
      timeoutSeconds,
    };
  }

  private async probeProviderInternal(input: ProviderProbeInput): Promise<ProviderResponseSummary> {
    const provider = this.getResolvedProviderConfig(input);

    try {
      const response = await this.fetchModelCatalog(provider);
      const payload = await this.safeJson(response);
      return {
        success: response.ok,
        statusCode: response.status,
        models: this.extractModelIds(provider.providerType, payload),
        error: response.ok ? undefined : this.extractErrorMessage(payload),
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown connectivity error',
      };
    }
  }

  private async fetchModelCatalog(provider: ProviderConfig): Promise<Response> {
    const { providerType, baseUrl, apiKey, timeoutSeconds } = provider;
    const signal = AbortSignal.timeout(timeoutSeconds * 1000);

    if (providerType === 'gemini') {
      return fetch(`${baseUrl.replace(/\/+$/, '')}/models?key=${encodeURIComponent(apiKey ?? '')}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });
    }

    if (providerType === 'anthropic') {
      return fetch(`${baseUrl.replace(/\/+$/, '')}/v1/models`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey ?? '',
        },
        signal,
      });
    }

    if (providerType === 'ollama') {
      return fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });
    }

    return fetch(this.resolveOpenAiModelsUrl(baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal,
    });
  }

  private extractModelIds(providerType: ProviderType, payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    if (providerType === 'gemini') {
      const models = Array.isArray((payload as { models?: unknown[] }).models)
        ? (payload as { models: Array<{ name?: string; displayName?: string }> }).models
        : [];

      return models
        .map((entry) => {
          const name = entry.name?.trim() || entry.displayName?.trim() || '';
          return name.startsWith('models/') ? name.slice('models/'.length) : name;
        })
        .filter((entry) => entry.length > 0)
        .sort((left, right) => left.localeCompare(right));
    }

    if (providerType === 'ollama') {
      const models = Array.isArray((payload as { models?: unknown[] }).models)
        ? (payload as { models: Array<{ name?: string; model?: string }> }).models
        : [];

      return models
        .map((entry) => entry.name?.trim() || entry.model?.trim() || '')
        .filter((entry) => entry.length > 0)
        .sort((left, right) => left.localeCompare(right));
    }

    const data = Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: Array<{ id?: string; name?: string; display_name?: string }> }).data
      : [];

    return data
      .map((entry) => entry.id?.trim() || entry.name?.trim() || entry.display_name?.trim() || '')
      .filter((entry) => entry.length > 0)
      .sort((left, right) => left.localeCompare(right));
  }

  private extractErrorMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const record = payload as {
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
    return undefined;
  }

  private resolveOpenAiModelsUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/+$/, '');
    if (normalized.endsWith('/models')) {
      return normalized;
    }
    if (normalized.endsWith('/v1')) {
      return `${normalized}/models`;
    }
    return `${normalized}/v1/models`;
  }

  private normalizeProviderInput(input: {
    name?: string;
    providerType: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    enabled?: boolean;
    timeoutSeconds?: number;
    maxTokens?: number;
    temperature?: number;
  }) {
    const providerType = this.normalizeProviderType(input.providerType);
    const defaults = PROVIDER_DEFAULTS[providerType];
    const trimmedName = input.name?.trim();

    return {
      name: trimmedName || this.getDefaultProviderName(providerType),
      providerType,
      baseUrl: this.normalizeBaseUrl(input.baseUrl?.trim() || defaults.baseUrl, providerType),
      model: input.model?.trim() || 'workflow-selected',
      apiKey: input.apiKey?.trim() || '',
      enabled: input.enabled,
      timeoutSeconds: input.timeoutSeconds,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    };
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

  private normalizeBaseUrl(baseUrl: string, providerType: ProviderType): string {
    const normalized = baseUrl.replace(/\/+$/, '');
    if (providerType === 'openai' && normalized === 'https://api.openai.com') {
      return 'https://api.openai.com/v1';
    }
    if (providerType === 'lm-studio' && normalized === 'http://localhost:1234/v1') {
      return normalized;
    }
    if (providerType === 'openai-compatible' && normalized === 'https://api.openai.com') {
      return 'https://api.openai.com/v1';
    }
    return normalized;
  }

  private getDefaultProviderName(providerType: ProviderType): string {
    switch (providerType) {
      case 'gemini':
        return 'Gemini';
      case 'anthropic':
        return 'Anthropic';
      case 'openai':
        return 'OpenAI';
      case 'openai-compatible':
        return 'OpenAI-compatible';
      case 'lm-studio':
        return 'LM Studio';
      case 'ollama':
        return 'Ollama';
    }
  }

  private async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text.slice(0, 400) };
    }
  }

  private serialize(provider: AiProviderRow) {
    return {
      id: provider.id,
      name: provider.name,
      providerType: this.normalizeProviderType(provider.providerType),
      baseUrl: provider.baseUrl,
      model: provider.model,
      enabled: Boolean(provider.enabled),
      timeoutSeconds: provider.timeoutSeconds,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
      hasApiKey: Boolean(provider.apiKeyEncrypted),
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
