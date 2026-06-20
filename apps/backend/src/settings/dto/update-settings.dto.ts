import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AuthMode } from '../../common/enums/auth-mode.enum';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  appName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultLanguage?: string;

  @IsOptional()
  @IsEnum(AuthMode)
  authMode?: AuthMode;

  @IsOptional()
  @IsString()
  @Min(8)
  password?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  sessionDurationMinutes?: number;

  @IsOptional()
  defaultAiProviderId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultSchedulingCron?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerTelegramChatId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegramBotUsername?: string | null;
}
