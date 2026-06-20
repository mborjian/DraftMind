import { Module, forwardRef } from '@nestjs/common';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { AuthModule } from '../auth/auth.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SettingsModule } from '../settings/settings.module';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';

@Module({
  imports: [SettingsModule, SecretsModule, AiProvidersModule, forwardRef(() => AuthModule)],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
