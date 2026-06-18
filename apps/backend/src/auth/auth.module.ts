import { Module } from '@nestjs/common';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SettingsModule, TelegramBotModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
