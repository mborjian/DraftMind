import { IsOptional, IsString } from 'class-validator';

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
