import { IsString } from 'class-validator';

export class SetupOtpTestRequestDto {
  @IsString()
  telegramBotToken!: string;

  @IsString()
  ownerTelegramChatId!: string;
}
