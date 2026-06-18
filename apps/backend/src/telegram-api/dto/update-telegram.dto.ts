import { IsOptional, IsString } from 'class-validator';

export class UpdateTelegramDto {
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
}
