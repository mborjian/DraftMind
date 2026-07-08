import { Body, Controller, Get, Post } from '@nestjs/common';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupAiProviderTestDto } from './dto/setup-ai-provider-test.dto';
import { SetupTelegramBotTestDto } from './dto/setup-telegram-bot-test.dto';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return {
      success: true,
      data: this.setupService.getStatus(),
    };
  }

  @Post('complete')
  async completeSetup(@Body() dto: CompleteSetupDto) {
    return {
      success: true,
      data: await this.setupService.completeSetup(dto),
    };
  }

  @Post('test-provider')
  async testProvider(@Body() dto: SetupAiProviderTestDto) {
    return {
      success: true,
      data: await this.setupService.testProviderConfiguration(dto),
    };
  }

  @Post('test-telegram-bot')
  async testTelegramBot(@Body() dto: SetupTelegramBotTestDto) {
    return {
      success: true,
      data: await this.setupService.testTelegramBotConfiguration(dto),
    };
  }
}
