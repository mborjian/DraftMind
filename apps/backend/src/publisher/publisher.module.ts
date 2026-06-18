import { Module, forwardRef } from '@nestjs/common';
import { PublicationsModule } from '../publications/publications.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { PublisherService } from './publisher.service';

@Module({
  imports: [PublicationsModule, forwardRef(() => TelegramBotModule)],
  providers: [PublisherService],
  exports: [PublisherService],
})
export class PublisherModule {}
