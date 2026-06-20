import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class SetupAiProviderTestDto {
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
}
