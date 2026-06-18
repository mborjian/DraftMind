import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PromptsModule } from '../prompts/prompts.module';
import { DraftsModule } from '../drafts/drafts.module';
import { TelegramApiModule } from '../telegram-api/telegram-api.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { TopicsModule } from '../topics/topics.module';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';

@Module({
  imports: [AiModule, PromptsModule, DraftsModule, TelegramApiModule, TelegramBotModule, TopicsModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
