import { Module } from '@nestjs/common';
import { AiPreferencesModule } from '../ai-preferences/ai-preferences.module';
import { AiModule } from '../ai/ai.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

@Module({
  imports: [AiPreferencesModule, AiModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
