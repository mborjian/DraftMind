import { forwardRef, Module } from '@nestjs/common';
import { TelegramApiModule } from '../telegram-api/telegram-api.module';
import { DraftsModule } from '../drafts/drafts.module';
import { PublisherModule } from '../publisher/publisher.module';
import { SettingsModule } from '../settings/settings.module';
import { TopicsModule } from '../topics/topics.module';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [TelegramApiModule, SettingsModule, forwardRef(() => TopicsModule), forwardRef(() => DraftsModule), forwardRef(() => PublisherModule)],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
