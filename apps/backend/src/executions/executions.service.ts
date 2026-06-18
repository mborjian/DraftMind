import { Injectable, NotFoundException } from '@nestjs/common';
import { DraftStatus } from '../common/enums/draft-status.enum';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { DatabaseService } from '../database/database.service';
import { TopicsService } from '../topics/topics.service';
import { TelegramApiService } from '../telegram-api/telegram-api.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly telegramApiService: TelegramApiService,
    private readonly topicsService: TopicsService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  listExecutions(filters: { workflowId?: number; status?: string; dateFrom?: string; dateTo?: string }) {
    let sql = 'SELECT * FROM WorkflowExecution WHERE 1 = 1';
    const params: Array<number | string> = [];

    if (filters.workflowId) {
      sql += ' AND workflowId = ?';
      params.push(filters.workflowId);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.dateFrom) {
      sql += ' AND startedAt >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ' AND startedAt <= ?';
      params.push(filters.dateTo);
    }

    sql += ' ORDER BY startedAt DESC';
    return this.databaseService.all(sql, params);
  }

  getExecution(id: number) {
    const execution = this.databaseService.get('SELECT * FROM WorkflowExecution WHERE id = ?', [id]);
    if (!execution) {
      throw new NotFoundException('Execution was not found.');
    }

    const topics = this.databaseService.all('SELECT * FROM Topic WHERE executionId = ? AND deletedAt IS NULL', [id]);
    const drafts = this.databaseService.all(
      `SELECT Draft.* FROM Draft
       INNER JOIN Topic ON Topic.id = Draft.topicId
       WHERE Topic.executionId = ? AND Draft.deletedAt IS NULL`,
      [id],
    );
    const aiLogs = this.databaseService.all('SELECT * FROM AIRequestLog WHERE executionId = ? ORDER BY createdAt DESC', [id]);
    const publications = this.databaseService.all(
      `SELECT Publication.* FROM Publication
       INNER JOIN Draft ON Draft.id = Publication.draftId
       INNER JOIN Topic ON Topic.id = Draft.topicId
       WHERE Topic.executionId = ?`,
      [id],
    );

    return { ...execution, topics, drafts, aiLogs, publications };
  }

  cancelExecution(id: number) {
    this.getExecution(id);
    this.databaseService.run('UPDATE WorkflowExecution SET status = ?, finishedAt = ?, errorMessage = ? WHERE id = ?', [
      ExecutionStatus.Cancelled,
      new Date().toISOString(),
      'Cancelled manually by the owner.',
      id,
    ]);
    return this.getExecution(id);
  }

  async startWorkflowExecution(workflowId: number): Promise<{ id: number }> {
    const workflow = this.databaseService.get<{
      id: number;
      name: string;
    }>('SELECT id, name FROM Workflow WHERE id = ? AND deletedAt IS NULL', [workflowId]);
    if (!workflow) {
      throw new NotFoundException('Workflow was not found.');
    }

    const running = this.databaseService.get<{ id: number }>(
      `SELECT id FROM WorkflowExecution
       WHERE workflowId = ? AND status IN (?, ?, ?, ?, ?)
       ORDER BY id DESC LIMIT 1`,
      [
        workflowId,
        ExecutionStatus.Collecting,
        ExecutionStatus.DetectingTopics,
        ExecutionStatus.AwaitingApproval,
        ExecutionStatus.AwaitingDraftReview,
        ExecutionStatus.GeneratingDrafts,
        ExecutionStatus.Publishing,
      ],
    );
    if (running) {
      return { id: running.id };
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const insert = this.databaseService.transaction(() => {
      const created = this.databaseService.run(
        `INSERT INTO WorkflowExecution (
          workflowId, startedAt, finishedAt, status, collectedMessageCount, detectedTopicCount,
          selectedTopicCount, generatedDraftCount, publishedDraftCount, totalTokens, estimatedCost, errorMessage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workflowId, startedAt, null, ExecutionStatus.Collecting, 0, 0, 0, 0, 0, 0, 0, null],
      );

      this.databaseService.run(
        'UPDATE WorkflowState SET status = ?, currentExecutionId = ?, lastRunAt = ?, lastError = ? WHERE workflowId = ?',
        [ExecutionStatus.Collecting, created.lastInsertRowid, startedAt, null, workflowId],
      );

      return created.lastInsertRowid;
    });

    void this.executePipeline({
      executionId: insert,
      workflowId,
      workflowName: workflow.name,
      windowStart,
      windowEnd: startedAt,
    });

    return { id: insert };
  }

  async executePipeline(input: {
    executionId: number;
    workflowId: number;
    workflowName: string;
    windowStart: string;
    windowEnd: string;
  }): Promise<void> {
    const ownerChatId = this.databaseService.get<{ ownerTelegramChatId: string | null }>('SELECT ownerTelegramChatId FROM AppSettings WHERE id = 1')?.ownerTelegramChatId ?? null;

    try {
      const collectedMessages = await this.telegramApiService.collectWorkflowMessages({
        workflowId: input.workflowId,
        executionId: input.executionId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      });

      this.databaseService.run(
        'UPDATE WorkflowExecution SET status = ?, collectedMessageCount = ? WHERE id = ?',
        [ExecutionStatus.DetectingTopics, collectedMessages.length, input.executionId],
      );
      this.databaseService.run('UPDATE WorkflowState SET status = ? WHERE workflowId = ?', [ExecutionStatus.DetectingTopics, input.workflowId]);

      const topics = await this.topicsService.detectTopicsForExecution(input.executionId);
      this.databaseService.run('UPDATE WorkflowExecution SET status = ? WHERE id = ?', [ExecutionStatus.AwaitingApproval, input.executionId]);
      this.databaseService.run('UPDATE WorkflowState SET status = ? WHERE workflowId = ?', [ExecutionStatus.AwaitingApproval, input.workflowId]);

      if (ownerChatId && topics.length > 0) {
        await this.telegramBotService.sendTopicReviewRequest(
          ownerChatId,
          topics.map((topic) => ({
            id: topic.id,
            executionId: topic.executionId,
            title: topic.title,
            summary: topic.summary,
            importanceScore: topic.importanceScore,
            confidenceScore: topic.confidenceScore,
            sourceMessageCount: topic.sourceMessageCount,
            approved: topic.approved ? 1 : 0,
            rejected: topic.rejected ? 1 : 0,
            regenerated: topic.regenerated,
          })),
        );
      }

      if (ownerChatId && topics.length === 0) {
        await this.telegramBotService.sendOperationalNotification(ownerChatId, `Workflow ${input.workflowName} produced no high-value topics for review.`);
      }

      if (topics.length === 0) {
        this.completeExecutionIfReady(input.executionId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed.';
      this.databaseService.transaction(() => {
        this.databaseService.run(
          'UPDATE WorkflowExecution SET status = ?, finishedAt = ?, errorMessage = ? WHERE id = ?',
          [ExecutionStatus.Failed, new Date().toISOString(), message, input.executionId],
        );
        this.databaseService.run(
          'UPDATE WorkflowState SET status = ?, currentExecutionId = NULL, lastError = ? WHERE workflowId = ?',
          [ExecutionStatus.Failed, message, input.workflowId],
        );
      });

      if (ownerChatId) {
        await this.telegramBotService.sendOperationalNotification(ownerChatId, `Workflow ${input.workflowName} failed: ${message}`);
      }
    }
  }

  completeExecutionIfReady(executionId: number) {
    const execution = this.databaseService.get<{ id: number; workflowId: number }>('SELECT id, workflowId FROM WorkflowExecution WHERE id = ?', [executionId]);
    if (!execution) {
      throw new NotFoundException('Execution was not found.');
    }

    const pendingTopics = this.databaseService.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM Topic WHERE executionId = ? AND deletedAt IS NULL AND approved = 0 AND rejected = 0',
      [executionId],
    )?.count ?? 0;
    if (pendingTopics > 0) {
      return this.getExecution(executionId);
    }

    const outstandingDrafts = this.databaseService.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM Draft
       INNER JOIN Topic ON Topic.id = Draft.topicId
       WHERE Topic.executionId = ?
         AND Draft.deletedAt IS NULL
         AND Draft.status = ?`,
      [executionId, DraftStatus.PendingReview],
    )?.count ?? 0;

    if (outstandingDrafts > 0) {
      return this.getExecution(executionId);
    }

    this.databaseService.transaction(() => {
      const finishedAt = new Date().toISOString();
      this.databaseService.run(
        'UPDATE WorkflowExecution SET status = ?, finishedAt = ? WHERE id = ?',
        [ExecutionStatus.Completed, finishedAt, executionId],
      );
      this.databaseService.run(
        'UPDATE WorkflowState SET status = ?, currentExecutionId = NULL, lastSuccessfulRunAt = ?, lastError = NULL WHERE workflowId = ?',
        [ExecutionStatus.Completed, finishedAt, execution.workflowId],
      );
    });

    return this.getExecution(executionId);
  }
}
