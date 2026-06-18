import { Injectable, NotFoundException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { AddWorkflowChatDto } from './dto/add-workflow-chat.dto';
import { DatabaseService } from '../database/database.service';
import { ExecutionsService } from '../executions/executions.service';

interface WorkflowRow {
  id: number;
  name: string;
  description: string | null;
  enabled: number;
  cronExpression: string;
  timezone: string;
  publishMode: string;
  publishIntervalMinutes: number;
  aiProviderId: number | null;
  aiPreferencesId: number | null;
  userPrompt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly executionsService: ExecutionsService,
  ) {}

  listWorkflows() {
    return this.databaseService.all<WorkflowRow>('SELECT * FROM Workflow WHERE deletedAt IS NULL ORDER BY updatedAt DESC').map((workflow) => this.hydrateWorkflow(workflow));
  }

  getWorkflow(id: number) {
    const workflow = this.databaseService.get<WorkflowRow>('SELECT * FROM Workflow WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!workflow) {
      throw new NotFoundException('Workflow was not found.');
    }
    return this.hydrateWorkflow(workflow);
  }

  createWorkflow(dto: CreateWorkflowDto) {
    const now = new Date().toISOString();
    const result = this.databaseService.transaction(() => {
      const insert = this.databaseService.run(
        `INSERT INTO Workflow (
          name, description, enabled, cronExpression, timezone, publishMode,
          publishIntervalMinutes, aiProviderId, aiPreferencesId, userPrompt,
          createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.description ?? null,
          dto.enabled === false ? 0 : 1,
          dto.cronExpression,
          dto.timezone,
          dto.publishMode,
          dto.publishIntervalMinutes,
          dto.aiProviderId ?? null,
          dto.aiPreferencesId ?? null,
          dto.userPrompt,
          now,
          now,
          null,
        ],
      );

      this.persistWorkflowChats('WorkflowSource', insert.lastInsertRowid, dto.sources);
      this.persistWorkflowChats('WorkflowDestination', insert.lastInsertRowid, dto.destinations);
      this.databaseService.run(
        'INSERT INTO WorkflowState (workflowId, status, lastRunAt, nextRunAt, currentExecutionId, lastSuccessfulRunAt, lastError) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [insert.lastInsertRowid, ExecutionStatus.Pending, null, this.computeNextRun(dto.cronExpression, dto.timezone), null, null, null],
      );

      return insert.lastInsertRowid;
    });

    return this.getWorkflow(result);
  }

  updateWorkflow(id: number, dto: UpdateWorkflowDto) {
    const current = this.databaseService.get<WorkflowRow>('SELECT * FROM Workflow WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!current) {
      throw new NotFoundException('Workflow was not found.');
    }

    const next = {
      ...current,
      ...dto,
      enabled: dto.enabled === undefined ? current.enabled : dto.enabled ? 1 : 0,
      updatedAt: new Date().toISOString(),
    };

    this.databaseService.transaction(() => {
      this.databaseService.run(
        `UPDATE Workflow SET
          name = ?, description = ?, enabled = ?, cronExpression = ?, timezone = ?, publishMode = ?,
          publishIntervalMinutes = ?, aiProviderId = ?, aiPreferencesId = ?, userPrompt = ?, updatedAt = ?
         WHERE id = ?`,
        [
          next.name,
          next.description,
          next.enabled,
          next.cronExpression,
          next.timezone,
          next.publishMode,
          next.publishIntervalMinutes,
          next.aiProviderId,
          next.aiPreferencesId,
          next.userPrompt,
          next.updatedAt,
          id,
        ],
      );

      if (dto.sources) {
        this.databaseService.run('DELETE FROM WorkflowSource WHERE workflowId = ?', [id]);
        this.persistWorkflowChats('WorkflowSource', id, dto.sources);
      }

      if (dto.destinations) {
        this.databaseService.run('DELETE FROM WorkflowDestination WHERE workflowId = ?', [id]);
        this.persistWorkflowChats('WorkflowDestination', id, dto.destinations);
      }

      this.databaseService.run(
        'UPDATE WorkflowState SET nextRunAt = ?, status = ? WHERE workflowId = ?',
        [this.computeNextRun(next.cronExpression, next.timezone), ExecutionStatus.Pending, id],
      );
    });

    return this.getWorkflow(id);
  }

  softDeleteWorkflow(id: number) {
    this.getWorkflow(id);
    this.databaseService.run('UPDATE Workflow SET deletedAt = ?, updatedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      new Date().toISOString(),
      id,
    ]);
    return { id };
  }

  setEnabled(id: number, enabled: boolean) {
    this.getWorkflow(id);
    this.databaseService.run('UPDATE Workflow SET enabled = ?, updatedAt = ? WHERE id = ?', [enabled ? 1 : 0, new Date().toISOString(), id]);
    return this.getWorkflow(id);
  }

  addSource(id: number, dto: AddWorkflowChatDto) {
    this.getWorkflow(id);
    this.databaseService.run(
      'INSERT INTO WorkflowSource (workflowId, telegramChatId, title, username, type) VALUES (?, ?, ?, ?, ?)',
      [id, dto.telegramChatId, dto.title, dto.username ?? null, dto.type],
    );
    return this.getWorkflow(id);
  }

  removeSource(id: number, sourceId: number) {
    this.getWorkflow(id);
    this.databaseService.run('DELETE FROM WorkflowSource WHERE id = ? AND workflowId = ?', [sourceId, id]);
    return this.getWorkflow(id);
  }

  addDestination(id: number, dto: AddWorkflowChatDto) {
    this.getWorkflow(id);
    this.databaseService.run(
      'INSERT INTO WorkflowDestination (workflowId, telegramChatId, title, username, type) VALUES (?, ?, ?, ?, ?)',
      [id, dto.telegramChatId, dto.title, dto.username ?? null, dto.type],
    );
    return this.getWorkflow(id);
  }

  removeDestination(id: number, destinationId: number) {
    this.getWorkflow(id);
    this.databaseService.run('DELETE FROM WorkflowDestination WHERE id = ? AND workflowId = ?', [destinationId, id]);
    return this.getWorkflow(id);
  }

  async runWorkflow(id: number) {
    const execution = await this.executionsService.startWorkflowExecution(id);
    return this.databaseService.get('SELECT * FROM WorkflowExecution WHERE id = ?', [execution.id]);
  }

  listDueWorkflowIds(referenceTime: Date = new Date()): number[] {
    const due = this.databaseService.all<{ workflowId: number }>(
      `SELECT Workflow.id AS workflowId
       FROM Workflow
       INNER JOIN WorkflowState ON WorkflowState.workflowId = Workflow.id
       WHERE Workflow.enabled = 1
         AND Workflow.deletedAt IS NULL
         AND WorkflowState.nextRunAt IS NOT NULL
         AND WorkflowState.nextRunAt <= ?
         AND WorkflowState.status NOT IN (?, ?, ?, ?, ?, ?)`,
      [
        referenceTime.toISOString(),
        ExecutionStatus.Collecting,
        ExecutionStatus.DetectingTopics,
        ExecutionStatus.AwaitingApproval,
        ExecutionStatus.GeneratingDrafts,
        ExecutionStatus.AwaitingDraftReview,
        ExecutionStatus.Publishing,
      ],
    );

    return due.map((row) => row.workflowId);
  }

  recomputeNextRun(workflowId: number): void {
    const workflow = this.databaseService.get<Pick<WorkflowRow, 'cronExpression' | 'timezone'>>(
      'SELECT cronExpression, timezone FROM Workflow WHERE id = ? AND deletedAt IS NULL',
      [workflowId],
    );
    if (!workflow) {
      return;
    }

    this.databaseService.run('UPDATE WorkflowState SET nextRunAt = ? WHERE workflowId = ?', [
      this.computeNextRun(workflow.cronExpression, workflow.timezone),
      workflowId,
    ]);
  }

  private persistWorkflowChats(tableName: 'WorkflowSource' | 'WorkflowDestination', workflowId: number, chats: AddWorkflowChatDto[]) {
    for (const chat of chats) {
      this.databaseService.run(
        `INSERT INTO ${tableName} (workflowId, telegramChatId, title, username, type) VALUES (?, ?, ?, ?, ?)`,
        [workflowId, chat.telegramChatId, chat.title, chat.username ?? null, chat.type],
      );
    }
  }

  private hydrateWorkflow(workflow: WorkflowRow) {
    const state = this.databaseService.get(
      'SELECT workflowId, status, lastRunAt, nextRunAt, currentExecutionId, lastSuccessfulRunAt, lastError FROM WorkflowState WHERE workflowId = ?',
      [workflow.id],
    );
    const sources = this.databaseService.all('SELECT id, telegramChatId, title, username, type FROM WorkflowSource WHERE workflowId = ?', [workflow.id]);
    const destinations = this.databaseService.all('SELECT id, telegramChatId, title, username, type FROM WorkflowDestination WHERE workflowId = ?', [workflow.id]);
    const lastExecution = this.databaseService.get(
      `SELECT id, startedAt, finishedAt, status, collectedMessageCount, detectedTopicCount,
        selectedTopicCount, generatedDraftCount, publishedDraftCount, totalTokens, estimatedCost
       FROM WorkflowExecution WHERE workflowId = ? ORDER BY startedAt DESC LIMIT 1`,
      [workflow.id],
    );

    return {
      ...workflow,
      enabled: Boolean(workflow.enabled),
      sources,
      destinations,
      state,
      lastExecution,
    };
  }

  private computeNextRun(expression: string, timezone: string): string | null {
    try {
      const cron = CronExpressionParser.parse(expression, { tz: timezone, currentDate: new Date() });
      return cron.next().toISOString();
    } catch {
      return null;
    }
  }
}
