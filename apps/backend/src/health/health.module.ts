import { Module } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TelegramApiModule } from '../telegram-api/telegram-api.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [SchedulerModule, TelegramApiModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
