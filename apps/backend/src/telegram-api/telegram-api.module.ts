import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramApiController } from './telegram-api.controller';
import { TelegramApiService } from './telegram-api.service';

@Module({
  imports: [SecretsModule, SettingsModule],
  controllers: [TelegramApiController],
  providers: [TelegramApiService],
  exports: [TelegramApiService],
})
export class TelegramApiModule {}
