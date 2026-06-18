import { Module } from '@nestjs/common';
import { AiPreferencesController } from './ai-preferences.controller';
import { AiPreferencesService } from './ai-preferences.service';

@Module({
  controllers: [AiPreferencesController],
  providers: [AiPreferencesService],
  exports: [AiPreferencesService],
})
export class AiPreferencesModule {}
