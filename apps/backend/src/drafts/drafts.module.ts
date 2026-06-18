import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PromptsModule } from '../prompts/prompts.module';
import { PublisherModule } from '../publisher/publisher.module';
import { TelegramApiModule } from '../telegram-api/telegram-api.module';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';

@Module({
  imports: [AiModule, PromptsModule, TelegramApiModule, forwardRef(() => PublisherModule)],
  controllers: [DraftsController],
  providers: [DraftsService],
  exports: [DraftsService],
})
export class DraftsModule {}
