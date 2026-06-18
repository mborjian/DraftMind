import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { AiProvidersService } from './ai-providers.service';

@Controller('ai/providers')
@UseGuards(SessionAuthGuard)
export class AiProvidersController {
  constructor(private readonly aiProvidersService: AiProvidersService) {}

  @Get()
  listProviders() {
    return { success: true, data: this.aiProvidersService.listProviders() };
  }

  @Post()
  createProvider(@Body() dto: CreateAiProviderDto) {
    return { success: true, data: this.aiProvidersService.createProvider(dto) };
  }

  @Put(':id')
  updateProvider(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiProviderDto) {
    return { success: true, data: this.aiProvidersService.updateProvider(id, dto) };
  }

  @Delete(':id')
  deleteProvider(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.aiProvidersService.deleteProvider(id) };
  }

  @Post(':id/test')
  async testProvider(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: await this.aiProvidersService.testProvider(id) };
  }
}
