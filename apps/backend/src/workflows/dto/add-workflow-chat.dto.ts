import { IsString, MaxLength } from 'class-validator';

export class AddWorkflowChatDto {
  @IsString()
  telegramChatId!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(120)
  username?: string | null;

  @IsString()
  @MaxLength(40)
  type!: string;
}
