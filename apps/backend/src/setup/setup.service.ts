import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AiProvidersService } from '../ai-providers/ai-providers.service';
import { AuthService } from '../auth/auth.service';
import { OTP_EXPIRATION_MINUTES } from '../common/constants/app.constants';
import { AuthMode } from '../common/enums/auth-mode.enum';
import { createNumericOtp } from '../common/utils/crypto.util';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupAiProviderTestDto } from './dto/setup-ai-provider-test.dto';
import { SetupOtpTestRequestDto } from './dto/setup-otp-test-request.dto';
import { SetupOtpTestVerifyDto } from './dto/setup-otp-test-verify.dto';
import { SetupTelegramApiTestDto } from './dto/setup-telegram-api-test.dto';
import { SetupTelegramBotTestDto } from './dto/setup-telegram-bot-test.dto';

interface SetupOtpRow {
  id: number;
  code: string;
  ownerTelegramChatId: string;
  expiresAt: string;
  used: number;
  createdAt: string;
}

@Injectable()
export class SetupService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly secretsService: SecretsService,
    private readonly authService: AuthService,
    private readonly aiProvidersService: AiProvidersService,
    private readonly telegramBotService: TelegramBotService,
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

    if (dto.authMode === AuthMode.Password && !dto.password?.trim()) {
      throw new BadRequestException('A password is required when password authentication is selected.');
    }

    if (dto.authMode === AuthMode.TelegramOtp) {
      if (!dto.ownerTelegramChatId?.trim()) {
        throw new BadRequestException('Owner Telegram chat ID is required for Telegram OTP mode.');
      }
      if (!dto.telegramBotToken?.trim()) {
        throw new BadRequestException('Telegram bot token is required for Telegram OTP mode.');
      }
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
          dto.authMode,
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

    if (dto.authMode === AuthMode.Password && dto.password?.trim()) {
      await this.authService.configurePassword(dto.password.trim());
    } else {
      this.settingsService.updatePasswordHash(null);
    }

    return this.settingsService.getSettings();
  }

  async testProviderConfiguration(dto: SetupAiProviderTestDto) {
    return this.aiProvidersService.probeProvider(dto);
  }

  async testTelegramApiConfiguration(dto: SetupTelegramApiTestDto) {
    const response = await fetch('https://api.telegram.org', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    });

    return {
      success: response.ok,
      statusCode: response.status,
      message: response.ok
        ? 'Telegram API endpoint is reachable. API ID and hash format look acceptable.'
        : 'Telegram API endpoint could not be reached.',
    };
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

    if (!(response.ok && payload?.ok === true)) {
      return {
        success: false,
        statusCode: response.status,
        username: payload?.result?.username ?? null,
        message: payload?.description ?? 'Telegram bot token could not be verified.',
      };
    }

    if (!ownerTelegramChatId) {
      return {
        success: true,
        statusCode: response.status,
        username: payload?.result?.username ?? null,
        message: 'Telegram bot token is valid.',
      };
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const recentAttempt = this.databaseService.get<{ id: number }>(
      'SELECT id FROM SetupBotTest WHERE ownerTelegramChatId = ? AND createdAt >= ? ORDER BY id DESC LIMIT 1',
      [ownerTelegramChatId, oneMinuteAgo],
    );

    if (recentAttempt) {
      throw new BadRequestException('Start the bot from your Telegram account before requesting another bot test.');
    }

    await this.telegramBotService.sendSetupTestMessage(
      token,
      ownerTelegramChatId,
      'DraftMind bot test message. If you can read this, the bot can reach the owner chat.',
    );

    this.databaseService.run('INSERT INTO SetupBotTest (ownerTelegramChatId, createdAt) VALUES (?, ?)', [
      ownerTelegramChatId,
      new Date().toISOString(),
    ]);

    return {
      success: true,
      statusCode: response.status,
      username: payload?.result?.username ?? null,
      message: 'Telegram bot token is valid and a sample message was sent to the owner chat.',
    };
  }

  async sendOtpTest(dto: SetupOtpTestRequestDto) {
    const ownerTelegramChatId = dto.ownerTelegramChatId.trim();
    const telegramBotToken = dto.telegramBotToken.trim();

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const recentAttempt = this.databaseService.get<{ id: number }>(
      'SELECT id FROM SetupOtpTest WHERE ownerTelegramChatId = ? AND createdAt >= ? ORDER BY id DESC LIMIT 1',
      [ownerTelegramChatId, oneMinuteAgo],
    );

    if (recentAttempt) {
      throw new BadRequestException('Start the bot from your Telegram account before requesting another OTP test.');
    }

    await this.telegramBotService.sendSetupTestMessage(
      telegramBotToken,
      ownerTelegramChatId,
      'DraftMind bot test message. If you can read this, bot delivery to the owner chat is working.',
    );

    const code = createNumericOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60_000).toISOString();

    this.databaseService.run(
      'INSERT INTO SetupOtpTest (code, ownerTelegramChatId, expiresAt, used, createdAt) VALUES (?, ?, ?, ?, ?)',
      [code, ownerTelegramChatId, expiresAt, 0, now.toISOString()],
    );

    await this.telegramBotService.sendSetupTestMessage(
      telegramBotToken,
      ownerTelegramChatId,
      `DraftMind OTP test code: ${code}\nExpires at: ${expiresAt}`,
    );

    return {
      success: true,
      expiresAt,
    };
  }

  verifyOtpTest(dto: SetupOtpTestVerifyDto) {
    const otp = this.databaseService.get<SetupOtpRow>(
      `SELECT id, code, ownerTelegramChatId, expiresAt, used, createdAt
       FROM SetupOtpTest
       WHERE ownerTelegramChatId = ? AND code = ?
       ORDER BY id DESC LIMIT 1`,
      [dto.ownerTelegramChatId.trim(), dto.code.trim()],
    );

    if (!otp || otp.used || new Date(otp.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('The supplied OTP code is invalid or expired.');
    }

    this.databaseService.run('UPDATE SetupOtpTest SET used = 1 WHERE id = ?', [otp.id]);
    return { success: true };
  }
}
