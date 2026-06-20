import { IsString } from 'class-validator';

export class SetupOtpTestVerifyDto {
  @IsString()
  ownerTelegramChatId!: string;

  @IsString()
  code!: string;
}
