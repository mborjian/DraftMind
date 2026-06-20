import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { APP_SETTINGS_ID } from '../common/constants/app.constants';
import { DatabaseService } from '../database/database.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface AppSettingsRecord {
  id: number;
  appName: string;
  timezone: string;
  locale: string;
  defaultLanguage: string;
  authMode: string;
  passwordHash: string | null;
  sessionDurationMinutes: number;
  defaultAiProviderId: number | null;
  defaultSchedulingCron: string | null;
  ownerTelegramChatId: string | null;
  telegramBotUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getSettings(): Omit<AppSettingsRecord, 'passwordHash'> {
    const settings = this.databaseService.get<AppSettingsRecord>(
      `SELECT id, appName, timezone, locale, defaultLanguage, authMode, sessionDurationMinutes,
        defaultAiProviderId, defaultSchedulingCron, ownerTelegramChatId, telegramBotUsername,
        createdAt, updatedAt
       FROM AppSettings WHERE id = ?`,
      [APP_SETTINGS_ID],
    );

    if (!settings) {
      throw new NotFoundException('Application settings are not initialized.');
    }

    return settings;
  }

  getSettingsWithPasswordHash(): AppSettingsRecord {
    const settings = this.databaseService.get<AppSettingsRecord>('SELECT * FROM AppSettings WHERE id = ?', [APP_SETTINGS_ID]);
    if (!settings) {
      throw new NotFoundException('Application settings are not initialized.');
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<Omit<AppSettingsRecord, 'passwordHash'>> {
    const current = this.getSettingsWithPasswordHash();
    const passwordHash = dto.password ? await argon2.hash(dto.password, { type: argon2.argon2id }) : current.passwordHash;
    const next = {
      ...current,
      ...dto,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };

    this.databaseService.run(
      `UPDATE AppSettings SET
        appName = ?, timezone = ?, locale = ?, defaultLanguage = ?, authMode = ?,
        passwordHash = ?, sessionDurationMinutes = ?, defaultAiProviderId = ?,
        defaultSchedulingCron = ?, ownerTelegramChatId = ?, telegramBotUsername = ?, updatedAt = ?
      WHERE id = ?`,
      [
        next.appName,
        next.timezone,
        next.locale,
        next.defaultLanguage,
        next.authMode,
        next.passwordHash,
        next.sessionDurationMinutes,
        next.defaultAiProviderId,
        next.defaultSchedulingCron,
        next.ownerTelegramChatId,
        next.telegramBotUsername,
        next.updatedAt,
        APP_SETTINGS_ID,
      ],
    );

    return this.getSettings();
  }

  updatePasswordHash(passwordHash: string | null): void {
    this.databaseService.run('UPDATE AppSettings SET passwordHash = ?, updatedAt = ? WHERE id = ?', [
      passwordHash,
      new Date().toISOString(),
      APP_SETTINGS_ID,
    ]);
  }
}
