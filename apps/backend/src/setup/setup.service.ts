import { BadRequestException, Injectable } from '@nestjs/common';
import { AiProvidersService } from '../ai-providers/ai-providers.service';
import { AuthMode } from '../common/enums/auth-mode.enum';
import { DatabaseService } from '../database/database.service';
import { LogsService } from '../logs/logs.service';
import { SecretsService } from '../secrets/secrets.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupAiProviderTestDto } from './dto/setup-ai-provider-test.dto';
import { SetupTelegramBotTestDto } from './dto/setup-telegram-bot-test.dto';

@Injectable()
export class SetupService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly secretsService: SecretsService,
    private readonly aiProvidersService: AiProvidersService,
    private readonly telegramBotService: TelegramBotService,
    private readonly logsService: LogsService,
  ) {}

  getStatus() {
    const settings = this.settingsService.getSettings();
    return {
      initialized: Boolean(settings.setupCompleted),
      authMode: settings.authMode,
    };
  }

  async completeSetup(dto: CompleteSetupDto) {
    const status = this.getStatus();
    if (status.initialized) {
      throw new BadRequestException('Initial setup has already been completed.');
    }

    const firstProvider = dto.aiProviders[0];
    if (!firstProvider) {
      throw new BadRequestException('At least one AI provider configuration is required.');
    }

    const normalizedProvider = this.aiProvidersService.getResolvedProviderConfig({
      providerType: firstProvider.providerType,
      baseUrl: firstProvider.baseUrl,
      apiKey: firstProvider.apiKey,
      timeoutSeconds: firstProvider.timeoutSeconds,
    });

    const providerName =
      firstProvider.name?.trim() ||
      (normalizedProvider.providerType === 'openai'
        ? 'OpenAI'
        : normalizedProvider.providerType === 'anthropic'
          ? 'Anthropic'
          : normalizedProvider.providerType === 'gemini'
            ? 'Gemini'
            : normalizedProvider.providerType === 'lm-studio'
              ? 'LM Studio'
              : normalizedProvider.providerType === 'ollama'
                ? 'Ollama'
                : 'OpenAI-compatible');

    const now = new Date().toISOString();

    this.databaseService.transaction(() => {
      this.databaseService.run('DELETE FROM AIProvider');

      this.databaseService.run(
        `UPDATE AppSettings SET
          appName = ?, timezone = ?, locale = ?, defaultLanguage = ?, setupCompleted = ?,
          authMode = ?, ownerTelegramChatId = ?, telegramBotUsername = ?, updatedAt = ?
         WHERE id = 1`,
        [
          dto.appName.trim(),
          dto.timezone.trim(),
          dto.locale?.trim() || 'en',
          dto.defaultLanguage?.trim() || 'English',
          1,
          AuthMode.None,
          dto.ownerTelegramChatId?.trim() || null,
          dto.telegramBotUsername?.trim() || null,
          now,
        ],
      );

      this.databaseService.run(
        `UPDATE Secrets SET telegramApiId = ?, telegramApiHashEncrypted = ?,
          telegramBotTokenEncrypted = ?, updatedAt = ? WHERE id = 1`,
        [
          dto.telegramApiId ?? null,
          dto.telegramApiHash?.trim() ? this.secretsService.encrypt(dto.telegramApiHash.trim()) : null,
          dto.telegramBotToken?.trim() ? this.secretsService.encrypt(dto.telegramBotToken.trim()) : null,
          now,
        ],
      );

      const result = this.databaseService.run(
        `INSERT INTO AIProvider (
          name, providerType, baseUrl, apiKeyEncrypted, model, enabled,
          timeoutSeconds, maxTokens, temperature, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          providerName,
          normalizedProvider.providerType,
          normalizedProvider.baseUrl,
          normalizedProvider.apiKey ? this.secretsService.encrypt(normalizedProvider.apiKey) : null,
          firstProvider.model?.trim() || 'workflow-selected',
          1,
          firstProvider.timeoutSeconds ?? 60,
          firstProvider.maxTokens ?? 2048,
          firstProvider.temperature ?? 0.4,
          now,
          now,
        ],
      );

      this.databaseService.run('UPDATE AppSettings SET defaultAiProviderId = ? WHERE id = 1', [result.lastInsertRowid]);
    });

    this.settingsService.updatePasswordHash(null);

    return this.settingsService.getSettings();
  }

  async testProviderConfiguration(dto: SetupAiProviderTestDto) {
    const result = await this.aiProvidersService.probeProvider(dto);
    if (result.success) {
      this.logsService.info(
        `Setup provider test succeeded for ${dto.providerType} (${result.statusCode})`,
        SetupService.name,
      );
    } else {
      this.logsService.warn(
        `Setup provider test failed for ${dto.providerType} (${result.statusCode}): ${result.error ?? 'No error details returned.'}`,
        SetupService.name,
      );
    }
    return result;
  }

  async testTelegramBotConfiguration(dto: SetupTelegramBotTestDto) {
    const token = dto.telegramBotToken.trim();
    const ownerTelegramChatId = dto.ownerTelegramChatId?.trim();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | null
      | {
          ok?: boolean;
          result?: { username?: string };
          description?: string;
        };
    const botUsername = payload?.result?.username
      ? `@${payload.result.username}`
      : dto.telegramBotUsername?.trim()
        ? `@${dto.telegramBotUsername.trim().replace(/^@/, '')}`
        : 'the bot';

    if (!(response.ok && payload?.ok === true)) {
      const rawMessage = payload?.description ?? 'Telegram bot token could not be verified.';
      const message = rawMessage.toLowerCase().includes('chat not found')
        ? `Start ${botUsername} in Telegram first, then run the test again.`
        : rawMessage;
      return {
        success: false,
        statusCode: response.status,
        username: payload?.result?.username ?? null,
        message,
      };
    }

    if (!ownerTelegramChatId) {
      this.logsService.warn(
        `Setup Telegram bot test blocked: owner chat id missing for ${botUsername}.`,
        SetupService.name,
      );
      return {
        success: false,
        statusCode: response.status,
        username: payload?.result?.username ?? null,
        message: `Bot token is valid. Enter the owner chat ID, start ${botUsername} in Telegram, then run the test again.`,
      };
    }

    try {
      await this.telegramBotService.sendSetupTestMessage(
        token,
        ownerTelegramChatId,
        'DraftMind bot test message. If you can read this, the bot can reach the owner chat.',
      );
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Telegram bot could not send the test message.';
      const message = rawMessage.toLowerCase().includes('chat not found')
        ? `Start ${botUsername} in Telegram first, then run the test again.`
        : rawMessage;
      this.logsService.warn(
        `Setup Telegram bot test failed for chat ${ownerTelegramChatId}: ${rawMessage}`,
        SetupService.name,
      );
      return {
        success: false,
        statusCode: response.status,
        username: payload?.result?.username ?? null,
        message,
      };
    }

    this.logsService.info(
      `Setup Telegram bot test succeeded for chat ${ownerTelegramChatId}.`,
      SetupService.name,
    );

    return {
      success: true,
      statusCode: response.status,
      username: payload?.result?.username ?? null,
      message: 'Bot token is valid and a test message was sent to the owner chat.',
    };
  }
}
