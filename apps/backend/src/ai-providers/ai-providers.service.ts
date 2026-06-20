import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { request } from 'undici';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

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
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutSeconds?: number;
}

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
    const now = new Date().toISOString();
    const result = this.databaseService.run(
      `INSERT INTO AIProvider (
        name, providerType, baseUrl, apiKeyEncrypted, model, enabled, timeoutSeconds,
        maxTokens, temperature, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name,
        dto.providerType,
        dto.baseUrl,
        dto.apiKey ? this.secretsService.encrypt(dto.apiKey) : null,
        dto.model,
        dto.enabled === false ? 0 : 1,
        dto.timeoutSeconds ?? 60,
        dto.maxTokens ?? 2048,
        dto.temperature ?? 0.4,
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

    const next = {
      ...current,
      ...dto,
      apiKeyEncrypted: dto.apiKey ? this.secretsService.encrypt(dto.apiKey) : current.apiKeyEncrypted,
      enabled: dto.enabled === undefined ? current.enabled : dto.enabled ? 1 : 0,
      timeoutSeconds: dto.timeoutSeconds ?? current.timeoutSeconds,
      maxTokens: dto.maxTokens ?? current.maxTokens,
      temperature: dto.temperature ?? current.temperature,
      updatedAt: new Date().toISOString(),
    };

    this.databaseService.run(
      `UPDATE AIProvider SET
        name = ?, providerType = ?, baseUrl = ?, apiKeyEncrypted = ?, model = ?, enabled = ?,
        timeoutSeconds = ?, maxTokens = ?, temperature = ?, updatedAt = ?
       WHERE id = ?`,
      [
        next.name,
        next.providerType,
        next.baseUrl,
        next.apiKeyEncrypted,
        next.model,
        next.enabled,
        next.timeoutSeconds,
        next.maxTokens,
        next.temperature,
        next.updatedAt,
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
    if (!apiKey) {
      throw new BadRequestException('Provider API key is not configured.');
    }

    try {
      const response = await this.fetchModelsResponse({
        providerType: provider.providerType,
        baseUrl: provider.baseUrl,
        apiKey,
        timeoutSeconds: provider.timeoutSeconds,
      });

      const models = await this.extractModelIds(response);

      return {
        success: response.statusCode >= 200 && response.statusCode < 500,
        statusCode: response.statusCode,
        models,
        provider: this.serialize(provider),
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown connectivity error',
        models: [],
        provider: this.serialize(provider),
      };
    }
  }

  async listModelsForProvider(id: number) {
    const provider = this.databaseService.get<AiProviderRow>('SELECT * FROM AIProvider WHERE id = ?', [id]);
    if (!provider) {
      throw new NotFoundException('AI provider was not found.');
    }

    const apiKey = this.secretsService.decrypt(provider.apiKeyEncrypted);
    if (!apiKey) {
      throw new BadRequestException('Provider API key is not configured.');
    }

    const response = await this.fetchModelsResponse({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey,
      timeoutSeconds: provider.timeoutSeconds,
    });

    return this.extractModelIds(response);
  }

  async probeProvider(input: ProviderProbeInput) {
    if (!input.apiKey?.trim()) {
      throw new BadRequestException('Provider API key is required.');
    }

    const response = await this.fetchModelsResponse({
      providerType: input.providerType,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      timeoutSeconds: input.timeoutSeconds ?? 60,
    });

    const models = await this.extractModelIds(response);
    return {
      success: response.statusCode >= 200 && response.statusCode < 500,
      statusCode: response.statusCode,
      models,
      provider: {
        name: input.name,
        providerType: input.providerType,
        baseUrl: input.baseUrl,
        model: input.model,
      },
    };
  }

  private async fetchModelsResponse(input: {
    providerType: string;
    baseUrl: string;
    apiKey: string;
    timeoutSeconds: number;
  }) {
    const endpoint = this.resolveModelsUrl(input.baseUrl, input.providerType);
    return request(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: 'application/json',
      },
      headersTimeout: input.timeoutSeconds * 1000,
      bodyTimeout: input.timeoutSeconds * 1000,
    });
  }

  private resolveModelsUrl(baseUrl: string, providerType: string): string {
    const normalized = baseUrl.replace(/\/+$/, '');
    if (normalized.endsWith('/models')) {
      return normalized;
    }
    if (normalized.endsWith('/v1')) {
      return `${normalized}/models`;
    }
    if (providerType === 'openai-compatible' || providerType === 'openrouter' || providerType === 'self-hosted') {
      return `${normalized}/v1/models`;
    }

    return `${normalized}/models`;
  }

  private async extractModelIds(response: Awaited<ReturnType<typeof request>>) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return [];
    }

    const payload = (await response.body.json().catch(() => null)) as
      | null
      | { data?: Array<{ id?: string; name?: string }> };

    if (!payload?.data || !Array.isArray(payload.data)) {
      return [];
    }

    return payload.data
      .map((entry) => (typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : typeof entry.name === 'string' ? entry.name.trim() : ''))
      .filter((entry) => entry.length > 0)
      .sort((left, right) => left.localeCompare(right));
  }

  private serialize(provider: AiProviderRow) {
    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
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
