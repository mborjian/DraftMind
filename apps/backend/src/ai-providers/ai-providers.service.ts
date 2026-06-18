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
      const response = await request(provider.baseUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        headersTimeout: provider.timeoutSeconds * 1000,
        bodyTimeout: provider.timeoutSeconds * 1000,
      });

      return {
        success: response.statusCode >= 200 && response.statusCode < 500,
        statusCode: response.statusCode,
        provider: this.serialize(provider),
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown connectivity error',
        provider: this.serialize(provider),
      };
    }
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
