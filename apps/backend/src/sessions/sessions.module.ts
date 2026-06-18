import { Global, Module } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  providers: [SessionsService, SessionAuthGuard],
  exports: [SessionsService, SessionAuthGuard],
})
export class SessionsModule {}
