import { Body, Controller, Get, Post } from '@nestjs/common';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupAiProviderTestDto } from './dto/setup-ai-provider-test.dto';
import { SetupOtpTestRequestDto } from './dto/setup-otp-test-request.dto';
import { SetupOtpTestVerifyDto } from './dto/setup-otp-test-verify.dto';
import { SetupTelegramApiTestDto } from './dto/setup-telegram-api-test.dto';
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

  @Post('test-telegram-api')
  async testTelegramApi(@Body() dto: SetupTelegramApiTestDto) {
    return {
      success: true,
      data: await this.setupService.testTelegramApiConfiguration(dto),
    };
  }

  @Post('test-telegram-bot')
  async testTelegramBot(@Body() dto: SetupTelegramBotTestDto) {
    return {
      success: true,
      data: await this.setupService.testTelegramBotConfiguration(dto),
    };
  }

  @Post('test-otp/send')
  async sendOtpTest(@Body() dto: SetupOtpTestRequestDto) {
    return {
      success: true,
      data: await this.setupService.sendOtpTest(dto),
    };
  }

  @Post('test-otp/verify')
  verifyOtpTest(@Body() dto: SetupOtpTestVerifyDto) {
    return {
      success: true,
      data: this.setupService.verifyOtpTest(dto),
    };
  }
}
