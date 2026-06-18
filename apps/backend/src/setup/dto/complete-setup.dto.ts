import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthMode } from '../../common/enums/auth-mode.enum';

class SetupAiProviderDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60)
  providerType!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  model!: string;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  temperature?: number;
}

export class CompleteSetupDto {
  @IsString()
  @MaxLength(120)
  appName!: string;

  @IsString()
  @MaxLength(100)
  timezone!: string;

  @IsString()
  @MaxLength(32)
  locale!: string;

  @IsString()
  @MaxLength(64)
  defaultLanguage!: string;

  @IsEnum(AuthMode)
  authMode!: AuthMode;

  @IsOptional()
  @IsString()
  @Min(8)
  password?: string;

  @IsInt()
  @Min(5)
  sessionDurationMinutes!: number;

  @IsOptional()
  telegramApiId?: number | null;

  @IsOptional()
  @IsString()
  telegramApiHash?: string | null;

  @IsOptional()
  @IsString()
  telegramSession?: string | null;

  @IsOptional()
  @IsString()
  telegramBotToken?: string | null;

  @IsOptional()
  @IsString()
  ownerTelegramChatId?: string | null;

  @IsOptional()
  @IsString()
  telegramBotUsername?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetupAiProviderDto)
  aiProviders!: SetupAiProviderDto[];
}
