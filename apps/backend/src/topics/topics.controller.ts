import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { TopicsService } from './topics.service';

@Controller()
@UseGuards(SessionAuthGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get('executions/:id/topics')
  listTopics(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.topicsService.listTopicsForExecution(id) };
  }

  @Post('topics/:id/approve')
  approveTopic(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.topicsService.approveTopic(id) };
  }

  @Post('topics/:id/reject')
  rejectTopic(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.topicsService.rejectTopic(id) };
  }

  @Post('topics/:id/regenerate')
  regenerateTopic(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.topicsService.regenerateTopic(id) };
  }
}
