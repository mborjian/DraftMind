import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ExecutionsService } from '../executions/executions.service';
import { PublisherService } from '../publisher/publisher.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly workflowsService: WorkflowsService,
    private readonly executionsService: ExecutionsService,
    private readonly publisherService: PublisherService,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      void this.runDueWorkflows();
    }, 60_000);

    void this.runDueWorkflows();
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getSchedulerStatus() {
    const activeWorkflows = this.databaseService.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM Workflow WHERE enabled = 1 AND deletedAt IS NULL',
    );
    const pendingNextRuns = this.databaseService.all(
      'SELECT workflowId, status, nextRunAt FROM WorkflowState ORDER BY nextRunAt ASC LIMIT 10',
    );

    return {
      activeWorkflowCount: activeWorkflows?.count ?? 0,
      nextRuns: pendingNextRuns,
      mode: 'in-process-single-instance',
    };
  }

  async runDueWorkflows(referenceTime: Date = new Date()): Promise<void> {
    await this.publisherService.publishScheduledDrafts(referenceTime);

    const workflowIds = this.workflowsService.listDueWorkflowIds(referenceTime);
    for (const workflowId of workflowIds) {
      await this.executionsService.startWorkflowExecution(workflowId);
      this.workflowsService.recomputeNextRun(workflowId);
    }
  }
}
