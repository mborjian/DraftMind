import { Controller, Get, Put, UseGuards, Body } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(SessionAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return {
      success: true,
      data: this.settingsService.getSettings(),
    };
  }

  @Put()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return {
      success: true,
      data: this.settingsService.updateSettings(dto),
    };
  }
}
