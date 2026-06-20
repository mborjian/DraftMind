import { forwardRef, Inject, BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DraftStatus } from '../common/enums/draft-status.enum';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { DatabaseService } from '../database/database.service';
import { PublisherService } from '../publisher/publisher.service';
import { PromptsService } from '../prompts/prompts.service';
import { TelegramApiService } from '../telegram-api/telegram-api.service';
import { UpdateDraftDto } from './dto/update-draft.dto';

interface DraftRow {
  id: number;
  topicId: number;
  workflowId: number;
  title: string;
  body: string;
  manuallyEdited: number;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface DraftResponsePayload {
  title?: string;
  body?: string;
}

@Injectable()
export class DraftsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
    private readonly telegramApiService: TelegramApiService,
    @Inject(forwardRef(() => PublisherService))
    private readonly publisherService: PublisherService,
  ) {}

  listDrafts() {
    return this.databaseService
      .all<DraftRow>('SELECT * FROM Draft WHERE deletedAt IS NULL ORDER BY updatedAt DESC')
      .map((draft) => this.serialize(draft));
  }

  getDraft(id: number) {
    const draft = this.databaseService.get<DraftRow>('SELECT * FROM Draft WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!draft) {
      throw new NotFoundException('Draft was not found.');
    }
    return this.serialize(draft);
  }

  updateDraft(id: number, dto: UpdateDraftDto) {
    const draft = this.getDraft(id);
    const updatedAt = new Date().toISOString();
    this.databaseService.run(
      'UPDATE Draft SET title = ?, body = ?, manuallyEdited = 1, updatedAt = ? WHERE id = ?',
      [dto.title ?? draft.title, dto.body ?? draft.body, updatedAt, id],
    );
    return this.getDraft(id);
  }

  async regenerateDraft(id: number) {
    const draft = this.databaseService.get<DraftRow>('SELECT * FROM Draft WHERE id = ? AND deletedAt IS NULL', [id]);
    if (!draft) {
      throw new NotFoundException('Draft was not found.');
    }

    return this.generateDraftForTopic(draft.topicId, {
      regenerate: true,
      previousDraftId: draft.id,
      regenerationFeedback: 'Draft regeneration requested by the owner.',
    });
  }

  saveDraft(id: number) {
    this.getDraft(id);
    this.databaseService.run('UPDATE Draft SET status = ?, updatedAt = ? WHERE id = ?', [
      DraftStatus.Saved,
      new Date().toISOString(),
      id,
    ]);
    this.reconcileExecutionAfterDraftDecision(id);
    return this.getDraft(id);
  }

  scheduleDraft(id: number, scheduledFor: string) {
    this.getDraft(id);
    this.databaseService.run('UPDATE Draft SET status = ?, scheduledFor = ?, updatedAt = ? WHERE id = ?', [
      DraftStatus.Scheduled,
      scheduledFor,
      new Date().toISOString(),
      id,
    ]);
    this.reconcileExecutionAfterDraftDecision(id);
    return this.getDraft(id);
  }

  async publishDraft(id: number) {
    this.getDraft(id);
    await this.publisherService.publishDraft(id);
    this.reconcileExecutionAfterDraftDecision(id);
    return this.getDraft(id);
  }

  async generateDraftForTopic(
    topicId: number,
    options?: {
      regenerate?: boolean;
      previousDraftId?: number;
      regenerationFeedback?: string | null;
    },
  ) {
    const topic = this.databaseService.get<{
      id: number;
      executionId: number;
      title: string;
      summary: string;
      importanceScore: number;
      confidenceScore: number;
      sourceMessageCount: number;
    }>('SELECT id, executionId, title, summary, importanceScore, confidenceScore, sourceMessageCount FROM Topic WHERE id = ? AND deletedAt IS NULL', [topicId]);
    if (!topic) {
      throw new NotFoundException('Topic was not found for draft generation.');
    }

    const execution = this.databaseService.get<{ id: number; workflowId: number }>('SELECT id, workflowId FROM WorkflowExecution WHERE id = ?', [topic.executionId]);
    if (!execution) {
      throw new NotFoundException('Execution was not found for draft generation.');
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
    if (!workflow || !workflow.aiProviderId) {
      throw new NotFoundException('The workflow AI provider is not configured.');
    }

    const sourceMessages = this.telegramApiService.getTopicSourceMessages(topicId);
    const previousDraft = options?.previousDraftId
      ? this.databaseService.get<DraftRow>('SELECT * FROM Draft WHERE id = ? AND deletedAt IS NULL', [options.previousDraftId])
      : this.databaseService.get<DraftRow>('SELECT * FROM Draft WHERE topicId = ? AND deletedAt IS NULL', [topicId]);

    const messages = this.promptsService.buildDraftPrompt({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        timezone: workflow.timezone,
        userPrompt: workflow.userPrompt,
      },
      topic: {
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        importanceScore: topic.importanceScore,
        confidenceScore: topic.confidenceScore,
        sourceMessageCount: topic.sourceMessageCount,
      },
      aiPreferencesId: workflow.aiPreferencesId,
      executionId: topic.executionId,
      sourceMessages: sourceMessages.map((message) => ({
        id: message.id,
        telegramMessageId: message.telegramMessageId,
        telegramChatId: message.telegramChatId,
        senderName: message.senderName,
        messageText: message.messageText,
        sentAt: message.sentAt,
      })),
      previousDraft: previousDraft ? { title: previousDraft.title, body: previousDraft.body } : null,
      regenerationFeedback: options?.regenerationFeedback ?? null,
    });

    const aiResult = await this.aiService.generate({
      providerId: workflow.aiProviderId,
      model: workflow.aiModel,
      purpose: options?.regenerate ? 'draft-regeneration' : 'draft-generation',
      workflowId: workflow.id,
      executionId: topic.executionId,
      messages,
      responseFormat: 'json_object',
    });

    const payload = this.safeParse<DraftResponsePayload>(aiResult.content);
    const draftTitle = payload?.title?.trim();
    const draftBody = payload?.body?.trim();
    if (!draftTitle || !draftBody) {
      throw new BadGatewayException('The AI provider returned an invalid draft payload.');
    }

    return this.databaseService.transaction(() => {
      const now = new Date().toISOString();
      const existingDraft = this.databaseService.get<DraftRow>('SELECT * FROM Draft WHERE topicId = ? AND deletedAt IS NULL', [topicId]);
      if (existingDraft) {
        this.databaseService.run(
          `UPDATE Draft
           SET title = ?, body = ?, manuallyEdited = 0, status = ?, scheduledFor = NULL, publishedAt = NULL, updatedAt = ?, deletedAt = NULL
           WHERE id = ?`,
          [draftTitle, draftBody, DraftStatus.PendingReview, now, existingDraft.id],
        );

        return this.getDraft(existingDraft.id);
      }

      const insert = this.databaseService.run(
        `INSERT INTO Draft (
          topicId, workflowId, title, body, manuallyEdited, status,
          scheduledFor, publishedAt, createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          topicId,
          workflow.id,
          draftTitle,
          draftBody,
          0,
          DraftStatus.PendingReview,
          null,
          null,
          now,
          now,
          null,
        ],
      );

      return this.getDraft(insert.lastInsertRowid);
    });
  }

  private safeParse<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private serialize(draft: DraftRow) {
    return {
      ...draft,
      manuallyEdited: Boolean(draft.manuallyEdited),
    };
  }

  private reconcileExecutionAfterDraftDecision(draftId: number): void {
    const execution = this.databaseService.get<{ id: number; workflowId: number }>(
      `SELECT WorkflowExecution.id AS id, WorkflowExecution.workflowId AS workflowId
       FROM WorkflowExecution
       INNER JOIN Topic ON Topic.executionId = WorkflowExecution.id
       WHERE Topic.id = (SELECT topicId FROM Draft WHERE id = ?)`,
      [draftId],
    );
    if (!execution) {
      return;
    }

    const pendingTopicCount = this.databaseService.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM Topic WHERE executionId = ? AND deletedAt IS NULL AND approved = 0 AND rejected = 0',
      [execution.id],
    )?.count ?? 0;
    const pendingReviewDraftCount = this.databaseService.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM Draft
       INNER JOIN Topic ON Topic.id = Draft.topicId
       WHERE Topic.executionId = ? AND Draft.deletedAt IS NULL AND Draft.status = ?`,
      [execution.id, DraftStatus.PendingReview],
    )?.count ?? 0;

    if (pendingTopicCount > 0 || pendingReviewDraftCount > 0) {
      return;
    }

    const finishedAt = new Date().toISOString();
    this.databaseService.transaction(() => {
      this.databaseService.run(
        'UPDATE WorkflowExecution SET status = ?, finishedAt = ? WHERE id = ?',
        [ExecutionStatus.Completed, finishedAt, execution.id],
      );
      this.databaseService.run(
        'UPDATE WorkflowState SET status = ?, currentExecutionId = NULL, lastSuccessfulRunAt = ?, lastError = NULL WHERE workflowId = ?',
        [ExecutionStatus.Completed, finishedAt, execution.workflowId],
      );
    });
  }
}
