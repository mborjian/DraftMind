import { IsInt, IsString, Min } from 'class-validator';

export class SetupTelegramApiTestDto {
  @IsInt()
  @Min(1)
  telegramApiId!: number;

  @IsString()
  telegramApiHash!: string;
}
