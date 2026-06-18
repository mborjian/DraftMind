import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { UpdateSystemPromptDto } from './dto/update-system-prompt.dto';
import { PromptsService } from './prompts.service';

@Controller('system-prompts')
@UseGuards(SessionAuthGuard)
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get()
  listSystemPrompts() {
    return { success: true, data: this.promptsService.listSystemPrompts() };
  }

  @Get(':id')
  getSystemPrompt(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.promptsService.getSystemPrompt(id) };
  }

  @Put(':id')
  updateSystemPrompt(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSystemPromptDto) {
    return { success: true, data: this.promptsService.updateSystemPrompt(id, dto) };
  }
}
