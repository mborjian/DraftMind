import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
