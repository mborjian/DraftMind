import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { ScheduleDraftDto } from './dto/schedule-draft.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { DraftsService } from './drafts.service';

@Controller('drafts')
@UseGuards(SessionAuthGuard)
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  listDrafts() {
    return { success: true, data: this.draftsService.listDrafts() };
  }

  @Get(':id')
  getDraft(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.draftsService.getDraft(id) };
  }

  @Put(':id')
  updateDraft(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDraftDto) {
    return { success: true, data: this.draftsService.updateDraft(id, dto) };
  }

  @Post(':id/regenerate')
  regenerateDraft(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.draftsService.regenerateDraft(id) };
  }

  @Post(':id/save')
  saveDraft(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.draftsService.saveDraft(id) };
  }

  @Post(':id/publish')
  async publishDraft(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: await this.draftsService.publishDraft(id) };
  }

  @Post(':id/schedule')
  scheduleDraft(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleDraftDto) {
    return { success: true, data: this.draftsService.scheduleDraft(id, dto.scheduledFor) };
  }
}
