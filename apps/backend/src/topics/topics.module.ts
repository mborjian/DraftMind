import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PromptsModule } from '../prompts/prompts.module';
import { DraftsModule } from '../drafts/drafts.module';
import { TelegramApiModule } from '../telegram-api/telegram-api.module';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [AiModule, DraftsModule, PromptsModule, TelegramApiModule],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
