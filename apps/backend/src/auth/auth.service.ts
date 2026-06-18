import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { OTP_EXPIRATION_MINUTES } from '../common/constants/app.constants';
import { createNumericOtp } from '../common/utils/crypto.util';
import { DatabaseService } from '../database/database.service';
import { SessionsService } from '../sessions/sessions.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

interface LoginOtpRow {
  id: number;
  code: string;
  expiresAt: string;
  used: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionsService: SessionsService,
    private readonly settingsService: SettingsService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async loginWithPassword(password: string): Promise<{ sessionToken: string; expiresAt: string }> {
    const settings = this.settingsService.getSettingsWithPasswordHash();
    if (!settings.passwordHash) {
      throw new BadRequestException('Password authentication is not configured.');
    }

    const verified = await argon2.verify(settings.passwordHash, password);
    if (!verified) {
      throw new UnauthorizedException('The supplied password is incorrect.');
    }

    const session = this.sessionsService.createSession(settings.sessionDurationMinutes);
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async configurePassword(password: string): Promise<void> {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    this.settingsService.updatePasswordHash(passwordHash);
  }

  requestOtp(): { success: true } {
    const settings = this.settingsService.getSettings();
    if (!settings.ownerTelegramChatId) {
      throw new BadRequestException('Owner Telegram chat ID must be configured before OTP login can be used.');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60_000).toISOString();
    const code = createNumericOtp();
    this.databaseService.run('INSERT INTO LoginOtp (code, expiresAt, used, createdAt) VALUES (?, ?, ?, ?)', [
      code,
      expiresAt,
      0,
      now.toISOString(),
    ]);

    this.telegramBotService.sendOtpCode(settings.ownerTelegramChatId, code, expiresAt);
    return { success: true };
  }

  verifyOtp(code: string): { sessionToken: string; expiresAt: string } {
    const otp = this.databaseService.get<LoginOtpRow>(
      'SELECT id, code, expiresAt, used FROM LoginOtp WHERE code = ? ORDER BY id DESC LIMIT 1',
      [code],
    );

    if (!otp || otp.used || new Date(otp.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('The supplied OTP code is invalid or expired.');
    }

    this.databaseService.run('UPDATE LoginOtp SET used = 1 WHERE id = ?', [otp.id]);
    const settings = this.settingsService.getSettings();
    const session = this.sessionsService.createSession(settings.sessionDurationMinutes);
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  logout(sessionToken: string): void {
    this.sessionsService.revokeTokenHash(sessionToken);
  }
}
