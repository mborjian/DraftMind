import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SetupModule } from './setup/setup.module';
import { SettingsModule } from './settings/settings.module';
import { SecretsModule } from './secrets/secrets.module';
import { AiProvidersModule } from './ai-providers/ai-providers.module';
import { AiPreferencesModule } from './ai-preferences/ai-preferences.module';
import { PromptsModule } from './prompts/prompts.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ExecutionsModule } from './executions/executions.module';
import { TelegramApiModule } from './telegram-api/telegram-api.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { TopicsModule } from './topics/topics.module';
import { DraftsModule } from './drafts/drafts.module';
import { PublisherModule } from './publisher/publisher.module';
import { PublicationsModule } from './publications/publications.module';
import { SessionsModule } from './sessions/sessions.module';
import { CostsModule } from './costs/costs.module';
import { LogsModule } from './logs/logs.module';
import { AiLogsModule } from './logs/ai-logs.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule.forRoot(),
    SecretsModule,
    SessionsModule,
    LogsModule,
    SettingsModule,
    TelegramApiModule,
    TelegramBotModule,
    AuthModule,
    SetupModule,
    AiProvidersModule,
    AiPreferencesModule,
    PromptsModule,
    WorkflowsModule,
    SchedulerModule,
    ExecutionsModule,
    TopicsModule,
    DraftsModule,
    PublicationsModule,
    PublisherModule,
    CostsModule,
    AiLogsModule,
    HealthModule,
  ],
})
export class AppModule {}
