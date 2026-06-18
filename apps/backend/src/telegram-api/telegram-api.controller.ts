import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { TelegramApiService } from './telegram-api.service';

@Controller('telegram')
@UseGuards(SessionAuthGuard)
export class TelegramApiController {
  constructor(private readonly telegramApiService: TelegramApiService) {}

  @Get()
  getStatus() {
    return { success: true, data: this.telegramApiService.getTelegramStatus() };
  }

  @Put()
  updateConfig(@Body() dto: UpdateTelegramDto) {
    return { success: true, data: this.telegramApiService.updateTelegramConfiguration(dto) };
  }

  @Post('test-api')
  testApi() {
    return { success: true, data: this.telegramApiService.testApiConnectivity() };
  }

  @Post('test-bot')
  testBot() {
    return { success: true, data: this.telegramApiService.testBotConnectivity() };
  }
}
