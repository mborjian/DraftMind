import { BadRequestException, Injectable } from '@nestjs/common';
import { AiProvidersService } from '../ai-providers/ai-providers.service';
import { AuthMode } from '../common/enums/auth-mode.enum';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupAiProviderTestDto } from './dto/setup-ai-provider-test.dto';

@Injectable()
export class SetupService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly secretsService: SecretsService,
    private readonly authService: AuthService,
    private readonly aiProvidersService: AiProvidersService,
  ) {}

  getStatus() {
    const settings = this.settingsService.getSettings();
    return {
      initialized: Boolean(settings.ownerTelegramChatId || settings.telegramBotUsername || settings.defaultAiProviderId),
      authMode: settings.authMode,
    };
  }

  async completeSetup(dto: CompleteSetupDto) {
    const status = this.getStatus();
    if (status.initialized) {
      throw new BadRequestException('Initial setup has already been completed.');
    }

    if (dto.authMode === AuthMode.Password && !dto.password) {
      throw new BadRequestException('A password is required when password authentication is selected.');
    }

    this.databaseService.transaction(() => {
      this.databaseService.run(
        `UPDATE AppSettings SET
          appName = ?, timezone = ?, locale = ?, defaultLanguage = ?, authMode = ?,
          sessionDurationMinutes = ?, ownerTelegramChatId = ?, telegramBotUsername = ?, updatedAt = ?
         WHERE id = 1`,
        [
          dto.appName,
          dto.timezone,
          dto.locale,
          dto.defaultLanguage,
          dto.authMode,
          dto.sessionDurationMinutes,
          dto.ownerTelegramChatId ?? null,
          dto.telegramBotUsername ?? null,
          new Date().toISOString(),
        ],
      );

      this.databaseService.run(
        `UPDATE Secrets SET telegramApiId = ?, telegramApiHashEncrypted = ?, telegramSessionEncrypted = ?,
          telegramBotTokenEncrypted = ?, updatedAt = ? WHERE id = 1`,
        [
          dto.telegramApiId ?? null,
          dto.telegramApiHash ? this.secretsService.encrypt(dto.telegramApiHash) : null,
          dto.telegramSession ? this.secretsService.encrypt(dto.telegramSession) : null,
          dto.telegramBotToken ? this.secretsService.encrypt(dto.telegramBotToken) : null,
          new Date().toISOString(),
        ],
      );

      for (const provider of dto.aiProviders) {
        const now = new Date().toISOString();
        const result = this.databaseService.run(
          `INSERT INTO AIProvider (
            name, providerType, baseUrl, apiKeyEncrypted, model, enabled,
            timeoutSeconds, maxTokens, temperature, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            provider.name,
            provider.providerType,
            provider.baseUrl,
            this.secretsService.encrypt(provider.apiKey),
            provider.model,
            1,
            provider.timeoutSeconds ?? 60,
            provider.maxTokens ?? 2048,
            provider.temperature ?? 0.4,
            now,
            now,
          ],
        );

        if (!dto.aiProviders.indexOf(provider)) {
          this.databaseService.run('UPDATE AppSettings SET defaultAiProviderId = ? WHERE id = 1', [result.lastInsertRowid]);
        }
      }
    });

    if (dto.password) {
      await this.authService.configurePassword(dto.password);
    }

    return this.settingsService.getSettings();
  }

  testProviderConfiguration(dto: SetupAiProviderTestDto) {
    return this.aiProvidersService.probeProvider(dto);
  }
}
