import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TelegramApiService } from '../telegram-api/telegram-api.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly schedulerService: SchedulerService,
    private readonly telegramApiService: TelegramApiService,
  ) {}

  getHealth() {
    const databaseCheck = this.databaseService.get<{ ok: number }>('SELECT 1 AS ok');
    const telegramStatus = this.telegramApiService.getTelegramStatus();
    return {
      api: 'ok',
      database: databaseCheck?.ok === 1 ? 'ok' : 'error',
      scheduler: this.schedulerService.getSchedulerStatus(),
      telegram: telegramStatus,
      aiProviders: 'configured-via-database',
    };
  }
}
