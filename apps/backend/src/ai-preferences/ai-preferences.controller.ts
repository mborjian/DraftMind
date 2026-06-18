import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CreateAiPreferencesDto } from './dto/create-ai-preferences.dto';
import { UpdateAiPreferencesDto } from './dto/update-ai-preferences.dto';
import { AiPreferencesService } from './ai-preferences.service';

@Controller('ai/preferences')
@UseGuards(SessionAuthGuard)
export class AiPreferencesController {
  constructor(private readonly aiPreferencesService: AiPreferencesService) {}

  @Get()
  listPreferences() {
    return { success: true, data: this.aiPreferencesService.listPreferences() };
  }

  @Get(':id')
  getPreference(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.aiPreferencesService.getPreference(id) };
  }

  @Post()
  createPreference(@Body() dto: CreateAiPreferencesDto) {
    return { success: true, data: this.aiPreferencesService.createPreference(dto) };
  }

  @Put(':id')
  updatePreference(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiPreferencesDto) {
    return { success: true, data: this.aiPreferencesService.updatePreference(id, dto) };
  }
}
