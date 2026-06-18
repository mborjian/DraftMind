import { PartialType } from '@nestjs/mapped-types';
import { CreateAiPreferencesDto } from './create-ai-preferences.dto';

export class UpdateAiPreferencesDto extends PartialType(CreateAiPreferencesDto) {}
