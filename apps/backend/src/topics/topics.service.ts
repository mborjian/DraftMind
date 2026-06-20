import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { DraftStatus } from '../common/enums/draft-status.enum';
import { DraftsService } from '../drafts/drafts.service';
import { DatabaseService } from '../database/database.service';
import { PromptsService } from '../prompts/prompts.service';
import { TelegramApiService } from '../telegram-api/telegram-api.service';

interface TopicRow {
  id: number;
  executionId: number;
  title: string;
  summary: string;
  importanceScore: number;
  confidenceScore: number;
  sourceMessageCount: number;
  approved: number;
  rejected: number;
  regenerated: number;
  createdAt: string;
  deletedAt: string | null;
}

interface TopicDetectionResult {
  topics?: Array<{
    title?: string;
    summary?: string;
    importanceScore?: number;
    confidenceScore?: number;
    sourceMessageIds?: number[];
  }>;
}

@Injectable()
export class TopicsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftsService: DraftsService,
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
    private readonly telegramApiService: TelegramApiService,
  ) {}

  listTopicsForExecution(executionId: number) {
    return this.databaseService
      .all<TopicRow>('SELECT * FROM Topic WHERE executionId = ? AND deletedAt IS NULL ORDER BY importanceScore DESC, id ASC', [executionId])
      .map((topic) => this.serialize(topic));
  }

  async detectTopicsForExecution(executionId: number): Promise<Array<ReturnType<TopicsService['serialize']>>> {
    const execution = this.databaseService.get<{
      id: number;
      workflowId: number;
    }>('SELECT id, workflowId FROM WorkflowExecution WHERE id = ?', [executionId]);
    if (!execution) {
      throw new NotFoundException('Execution was not found.');
    }

    const workflow = this.databaseService.get<{
      id: number;
      name: string;
      description: string | null;
      timezone: string;
      userPrompt: string;
      aiProviderId: number | null;
      aiModel: string | null;
      aiPreferencesId: number | null;
    }>('SELECT id, name, description, timezone, userPrompt, aiProviderId, aiModel, aiPreferencesId FROM Workflow WHERE id = ?', [execution.workflowId]);
    if (!workflow) {
      throw new NotFoundException('Workflow was not found for topic detection.');
    }
    if (!workflow.aiProviderId) {
      throw new NotFoundException('No AI provider is configured for the workflow.');
    }

    const sourceMessages = this.telegramApiService.getExecutionMessages(executionId);
    const prompt = this.promptsService.buildTopicDetectionPrompt({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        timezone: workflow.timezone,
        userPrompt: workflow.userPrompt,
      },
      executionId,
      aiPreferencesId: workflow.aiPreferencesId,
      sourceMessages: sourceMessages.map((message) => ({
        id: message.id,
        telegramMessageId: message.telegramMessageId,
        telegramChatId: message.telegramChatId,
        senderName: message.senderName,
        messageText: message.messageText,
        sentAt: message.sentAt,
      })),
    });

    const response = await this.aiService.generate({
      providerId: workflow.aiProviderId,
      model: workflow.aiModel,
      purpose: 'topic-detection',
      workflowId: workflow.id,
      executionId,
      messages: prompt,
      responseFormat: 'json_object',
      temperature: 0.1,
    });

    const parsed = this.safeParse<TopicDetectionResult>(response.content);
    if (!parsed?.topics || !Array.isArray(parsed.topics)) {
      throw new BadGatewayException('The AI provider returned an invalid topic-detection payload.');
    }

    const detectedTopics = parsed.topics;

    return this.databaseService.transaction(() => {
      this.databaseService.run('DELETE FROM TopicSourceMessage WHERE topicId IN (SELECT id FROM Topic WHERE executionId = ?)', [executionId]);
      this.databaseService.run('DELETE FROM Topic WHERE executionId = ?', [executionId]);

      const persisted = detectedTopics
        .map((topic) => this.persistDetectedTopic(executionId, topic, sourceMessages))
        .filter((topic): topic is ReturnType<TopicsService['serialize']> => topic !== null);

      this.databaseService.run(
        'UPDATE WorkflowExecution SET detectedTopicCount = ? WHERE id = ?',
        [persisted.length, executionId],
      );

      return persisted;
    });
  }

  async approveTopic(id: number) {
    const topic = this.databaseService.get<TopicRow>('SELECT * FROM Topic WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!topic) {
      throw new NotFoundException('Topic was not found.');
    }

    const execution = this.getExecutionContext(topic.executionId);

    this.databaseService.run('UPDATE Topic SET approved = 1, rejected = 0 WHERE id = ?', [id]);
    const draft = await this.draftsService.generateDraftForTopic(id);

    this.databaseService.run(
      `UPDATE WorkflowExecution
       SET status = ?, selectedTopicCount = (SELECT COUNT(*) FROM Topic WHERE executionId = ? AND approved = 1),
           generatedDraftCount = (SELECT COUNT(*) FROM Draft INNER JOIN Topic ON Topic.id = Draft.topicId WHERE Topic.executionId = ? AND Draft.deletedAt IS NULL)
       WHERE id = ?`,
      [ExecutionStatus.AwaitingDraftReview, topic.executionId, topic.executionId, topic.executionId],
    );
    this.databaseService.run(
      'UPDATE WorkflowState SET status = ? WHERE workflowId = ?',
      [ExecutionStatus.AwaitingDraftReview, execution.workflowId],
    );

    return {
      ...this.serialize(topic),
      approved: true,
      rejected: false,
      generatedDraftId: draft.id,
    };
  }

  rejectTopic(id: number) {
    const topic = this.databaseService.get<TopicRow>('SELECT * FROM Topic WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!topic) {
      throw new NotFoundException('Topic was not found.');
    }

    this.databaseService.run('UPDATE Topic SET approved = 0, rejected = 1 WHERE id = ?', [id]);
    const execution = this.getExecutionContext(topic.executionId);
    this.reconcileExecutionTopicReview(topic.executionId, execution.workflowId);
    return this.listTopicsForExecution(topic.executionId).find((entry) => entry.id === id);
  }

  async regenerateTopic(id: number) {
    const topic = this.databaseService.get<TopicRow>('SELECT * FROM Topic WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!topic) {
      throw new NotFoundException('Topic was not found.');
    }

    const execution = this.getExecutionContext(topic.executionId);
    const regeneratedTopics = await this.detectTopicsForExecution(topic.executionId);
    this.databaseService.run('UPDATE WorkflowExecution SET status = ? WHERE id = ?', [ExecutionStatus.AwaitingApproval, topic.executionId]);
    this.databaseService.run('UPDATE WorkflowState SET status = ? WHERE workflowId = ?', [ExecutionStatus.AwaitingApproval, execution.workflowId]);
    return regeneratedTopics;
  }

  private persistDetectedTopic(
    executionId: number,
    topic: NonNullable<TopicDetectionResult['topics']>[number],
    sourceMessages: Array<{ id: number }>,
  ): ReturnType<TopicsService['serialize']> | null {
    const title = (topic.title ?? '').trim();
    const summary = (topic.summary ?? '').trim();
    const sourceMessageIds = Array.isArray(topic.sourceMessageIds)
      ? topic.sourceMessageIds.filter((messageId) => sourceMessages.some((message) => message.id === messageId))
      : [];

    if (!title || !summary || sourceMessageIds.length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    const insert = this.databaseService.run(
      `INSERT INTO Topic (
        executionId, title, summary, importanceScore, confidenceScore, sourceMessageCount,
        approved, rejected, regenerated, createdAt, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        executionId,
        title,
        summary,
        this.normalizeScore(topic.importanceScore),
        this.normalizeScore(topic.confidenceScore),
        sourceMessageIds.length,
        0,
        0,
        0,
        now,
        null,
      ],
    );

    for (const messageId of sourceMessageIds) {
      this.databaseService.run(
        'INSERT INTO TopicSourceMessage (topicId, telegramMessageId) VALUES (?, ?)',
        [insert.lastInsertRowid, messageId],
      );
    }

    const persisted = this.databaseService.get<TopicRow>('SELECT * FROM Topic WHERE id = ?', [insert.lastInsertRowid]);
    if (!persisted) {
      return null;
    }

    return this.serialize(persisted);
  }

  private normalizeScore(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, value));
  }

  private safeParse<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private serialize(topic: TopicRow) {
    return {
      ...topic,
      approved: Boolean(topic.approved),
      rejected: Boolean(topic.rejected),
    };
  }

  private getExecutionContext(executionId: number): { id: number; workflowId: number } {
    const execution = this.databaseService.get<{ id: number; workflowId: number }>(
      'SELECT id, workflowId FROM WorkflowExecution WHERE id = ?',
      [executionId],
    );
    if (!execution) {
      throw new NotFoundException('Execution was not found for the selected topic.');
    }
    return execution;
  }

  private reconcileExecutionTopicReview(executionId: number, workflowId: number): void {
    const pendingTopicCount = this.databaseService.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM Topic WHERE executionId = ? AND deletedAt IS NULL AND approved = 0 AND rejected = 0',
      [executionId],
    )?.count ?? 0;

    const pendingReviewDraftCount = this.databaseService.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM Draft
       INNER JOIN Topic ON Topic.id = Draft.topicId
       WHERE Topic.executionId = ? AND Draft.deletedAt IS NULL AND Draft.status = ?`,
      [executionId, DraftStatus.PendingReview],
    )?.count ?? 0;

    if (pendingTopicCount === 0 && pendingReviewDraftCount === 0) {
      const finishedAt = new Date().toISOString();
      this.databaseService.transaction(() => {
        this.databaseService.run(
          'UPDATE WorkflowExecution SET status = ?, finishedAt = ? WHERE id = ?',
          [ExecutionStatus.Completed, finishedAt, executionId],
        );
        this.databaseService.run(
          'UPDATE WorkflowState SET status = ?, currentExecutionId = NULL, lastSuccessfulRunAt = ?, lastError = NULL WHERE workflowId = ?',
          [ExecutionStatus.Completed, finishedAt, workflowId],
        );
      });
    }
  }
}
