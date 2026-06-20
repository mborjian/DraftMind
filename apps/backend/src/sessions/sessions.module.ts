import { Global, Module } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { SettingsModule } from '../settings/settings.module';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [SessionsService, SessionAuthGuard],
  exports: [SessionsService, SessionAuthGuard],
})
export class SessionsModule {}
