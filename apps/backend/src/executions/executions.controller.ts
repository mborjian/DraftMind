import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { ExecutionsService } from './executions.service';

@Controller('executions')
@UseGuards(SessionAuthGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  listExecutions(
    @Query('workflow') workflow: string | undefined,
    @Query('status') status: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
  ) {
    return {
      success: true,
      data: this.executionsService.listExecutions({
        workflowId: workflow ? Number(workflow) : undefined,
        status,
        dateFrom,
        dateTo,
      }),
    };
  }

  @Get(':id')
  getExecution(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.executionsService.getExecution(id) };
  }

  @Post(':id/cancel')
  cancelExecution(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.executionsService.cancelExecution(id) };
  }
}
