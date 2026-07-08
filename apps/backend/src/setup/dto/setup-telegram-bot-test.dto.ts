import { IsOptional, IsString } from 'class-validator';

export class SetupTelegramBotTestDto {
  @IsString()
  telegramBotToken!: string;

  @IsOptional()
  @IsString()
  telegramBotUsername?: string;

  @IsOptional()
  @IsString()
  ownerTelegramChatId?: string;
}
