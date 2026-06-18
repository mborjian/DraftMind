import { Module } from '@nestjs/common';
import { ExecutionsModule } from '../executions/executions.module';
import { PublisherModule } from '../publisher/publisher.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ExecutionsModule, WorkflowsModule, PublisherModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
