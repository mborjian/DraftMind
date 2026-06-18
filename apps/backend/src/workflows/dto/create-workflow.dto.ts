import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WorkflowPublishMode } from '../../common/enums/workflow-publish-mode.enum';

class WorkflowChatDto {
  @IsString()
  telegramChatId!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  username?: string | null;

  @IsString()
  @MaxLength(40)
  type!: string;
}

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  enabled?: boolean;

  @IsString()
  cronExpression!: string;

  @IsString()
  timezone!: string;

  @IsEnum(WorkflowPublishMode)
  publishMode!: WorkflowPublishMode;

  @IsInt()
  @Min(0)
  publishIntervalMinutes!: number;

  @IsOptional()
  aiProviderId?: number | null;

  @IsOptional()
  aiPreferencesId?: number | null;

  @IsString()
  userPrompt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowChatDto)
  sources!: WorkflowChatDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowChatDto)
  destinations!: WorkflowChatDto[];
}
