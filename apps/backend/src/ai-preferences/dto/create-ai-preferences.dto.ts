import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAiPreferencesDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60)
  language!: string;

  @IsString()
  @MaxLength(60)
  tone!: string;

  @IsInt() @Min(0) @Max(100) formality!: number;
  @IsInt() @Min(0) @Max(100) harshness!: number;
  @IsInt() @Min(0) @Max(100) softness!: number;
  @IsInt() @Min(0) @Max(100) creativity!: number;
  @IsInt() @Min(0) @Max(100) bravery!: number;
  @IsInt() @Min(0) @Max(100) professionalism!: number;
  @IsInt() @Min(0) @Max(100) emotionalIntensity!: number;

  @IsString() @MaxLength(60) readingLevel!: string;
  @IsString() @MaxLength(60) audienceType!: string;
  @IsInt() @Min(0) @Max(100) technicalDepth!: number;
  @IsInt() @Min(0) @Max(100) storytelling!: number;
  @IsInt() @Min(0) @Max(100) persuasiveness!: number;
  @IsInt() @Min(0) @Max(100) objectivity!: number;

  @IsBoolean() seoEnabled!: boolean;
  @IsBoolean() hashtagsEnabled!: boolean;
  @IsBoolean() markdownEnabled!: boolean;
  @IsBoolean() callToActionEnabled!: boolean;

  @IsInt() @Min(0) @Max(3) emojiLevel!: number;
  @IsString() @MaxLength(40) sentenceLength!: string;
  @IsString() @MaxLength(40) paragraphLength!: string;
  @IsInt() @Min(0) @Max(100) brandConsistency!: number;

  @IsOptional()
  @IsString()
  customPreferencesJson?: string | null;
}
