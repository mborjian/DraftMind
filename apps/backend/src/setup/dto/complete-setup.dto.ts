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
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsString()
  @MaxLength(60)
  providerType!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultLanguage?: string;

  @IsEnum(AuthMode)
  authMode!: AuthMode;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  telegramApiId?: number | null;

  @IsOptional()
  @IsString()
  telegramApiHash?: string | null;

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
