import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class SetupAiProviderTestDto {
  @IsString()
  @MaxLength(60)
  providerType!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutSeconds?: number;
}
