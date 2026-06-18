import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AddWorkflowChatDto } from './dto/add-workflow-chat.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
@UseGuards(SessionAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  listWorkflows() {
    return { success: true, data: this.workflowsService.listWorkflows() };
  }

  @Get(':id')
  getWorkflow(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.getWorkflow(id) };
  }

  @Post()
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return { success: true, data: this.workflowsService.createWorkflow(dto) };
  }

  @Put(':id')
  updateWorkflow(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkflowDto) {
    return { success: true, data: this.workflowsService.updateWorkflow(id, dto) };
  }

  @Delete(':id')
  deleteWorkflow(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.softDeleteWorkflow(id) };
  }

  @Post(':id/enable')
  enableWorkflow(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.setEnabled(id, true) };
  }

  @Post(':id/disable')
  disableWorkflow(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.setEnabled(id, false) };
  }

  @Post(':id/run')
  runWorkflow(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.runWorkflow(id) };
  }

  @Get(':id/sources')
  getSources(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.getWorkflow(id).sources };
  }

  @Post(':id/sources')
  addSource(@Param('id', ParseIntPipe) id: number, @Body() dto: AddWorkflowChatDto) {
    return { success: true, data: this.workflowsService.addSource(id, dto) };
  }

  @Delete(':id/sources/:sourceId')
  removeSource(@Param('id', ParseIntPipe) id: number, @Param('sourceId', ParseIntPipe) sourceId: number) {
    return { success: true, data: this.workflowsService.removeSource(id, sourceId) };
  }

  @Get(':id/destinations')
  getDestinations(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.workflowsService.getWorkflow(id).destinations };
  }

  @Post(':id/destinations')
  addDestination(@Param('id', ParseIntPipe) id: number, @Body() dto: AddWorkflowChatDto) {
    return { success: true, data: this.workflowsService.addDestination(id, dto) };
  }

  @Delete(':id/destinations/:destinationId')
  removeDestination(@Param('id', ParseIntPipe) id: number, @Param('destinationId', ParseIntPipe) destinationId: number) {
    return { success: true, data: this.workflowsService.removeDestination(id, destinationId) };
  }
}
