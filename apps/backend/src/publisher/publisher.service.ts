import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DraftStatus } from '../common/enums/draft-status.enum';
import { DatabaseService } from '../database/database.service';
import { ExecutionStatus } from '../common/enums/execution-status.enum';
import { LogsService } from '../logs/logs.service';
import { PublicationsService } from '../publications/publications.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

interface PublicationRecord {
  id: number;
  status: string;
}

@Injectable()
export class PublisherService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly publicationsService: PublicationsService,
    private readonly logsService: LogsService,
    @Inject(forwardRef(() => TelegramBotService))
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async publishDraft(draftId: number) {
    const draft = this.databaseService.get<{ id: number; workflowId: number; title: string; body: string }>(
      'SELECT id, workflowId, title, body FROM Draft WHERE id = ? AND deletedAt IS NULL',
      [draftId],
    );
    if (!draft) {
      throw new NotFoundException('Draft was not found.');
    }

    const destinations = this.databaseService.all<{ id: number; telegramChatId: string; title: string }>(
      'SELECT id, telegramChatId, title FROM WorkflowDestination WHERE workflowId = ?',
      [draft.workflowId],
    );

    const deliveries: PublicationRecord[] = [];
    for (const destination of destinations) {
      try {
        const message = await this.telegramBotService.sendOperationalNotification(
          destination.telegramChatId,
          [draft.title, '', draft.body].join('\n'),
        );
        deliveries.push(
          this.publicationsService.recordPublication(
            draft.id,
            destination.id,
            message.delivered ? (message.messageId ?? null) : null,
            message.delivered,
            message.delivered ? null : 'Delivery failed.',
          ) as PublicationRecord,
        );
      } catch (error) {
        deliveries.push(
          this.publicationsService.recordPublication(
            draft.id,
            destination.id,
            null,
            false,
            error instanceof Error ? error.message : 'Telegram publication failed.',
          ) as PublicationRecord,
        );
      }
    }

    const successfulCount = deliveries.filter((delivery) => delivery.status === 'sent').length;
    const publishedAt = new Date().toISOString();
    this.databaseService.run('UPDATE Draft SET status = ?, publishedAt = ?, updatedAt = ? WHERE id = ?', [
      DraftStatus.Published,
      publishedAt,
      publishedAt,
      draftId,
    ]);

    const execution = this.databaseService.get<{ id: number }>(
      `SELECT WorkflowExecution.id AS id
       FROM WorkflowExecution
       INNER JOIN Topic ON Topic.executionId = WorkflowExecution.id
       WHERE Topic.id = (SELECT topicId FROM Draft WHERE id = ?)`,
      [draftId],
    );
    if (execution) {
      this.databaseService.run(
        `UPDATE WorkflowExecution
         SET publishedDraftCount = (
           SELECT COUNT(*) FROM Draft
           INNER JOIN Topic ON Topic.id = Draft.topicId
           WHERE Topic.executionId = ? AND Draft.publishedAt IS NOT NULL AND Draft.deletedAt IS NULL
         )
         WHERE id = ?`,
        [execution.id, execution.id],
      );
    }

    return {
      draftId,
      publicationCount: successfulCount,
      deliveries,
    };
  }

  async publishScheduledDrafts(referenceTime: Date = new Date()): Promise<number> {
    const dueDrafts = this.databaseService.all<{ id: number }>(
      `SELECT id FROM Draft
       WHERE deletedAt IS NULL
         AND status = ?
         AND scheduledFor IS NOT NULL
         AND scheduledFor <= ?
       ORDER BY scheduledFor ASC, id ASC`,
      [DraftStatus.Scheduled, referenceTime.toISOString()],
    );

    let publishedCount = 0;
    for (const draft of dueDrafts) {
      try {
        await this.publishDraft(draft.id);
        publishedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Scheduled publication failed.';
        this.logsService.error(`Scheduled publication failed for draft ${draft.id}: ${message}`, undefined, PublisherService.name);

        const execution = this.databaseService.get<{ id: number; workflowId: number }>(
          `SELECT WorkflowExecution.id AS id, WorkflowExecution.workflowId AS workflowId
           FROM WorkflowExecution
           INNER JOIN Topic ON Topic.executionId = WorkflowExecution.id
           WHERE Topic.id = (SELECT topicId FROM Draft WHERE id = ?)`,
          [draft.id],
        );

        if (execution) {
          this.databaseService.run(
            'UPDATE WorkflowExecution SET status = ?, errorMessage = ? WHERE id = ?',
            [ExecutionStatus.Failed, message, execution.id],
          );
          this.databaseService.run(
            'UPDATE WorkflowState SET status = ?, currentExecutionId = NULL, lastError = ? WHERE workflowId = ?',
            [ExecutionStatus.Failed, message, execution.workflowId],
          );
        }
      }
    }

    return publishedCount;
  }
}
