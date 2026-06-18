import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicationStatus } from '../common/enums/publication-status.enum';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PublicationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listPublications() {
    return this.databaseService.all(
      `SELECT Publication.*, WorkflowDestination.title AS destinationTitle, WorkflowDestination.telegramChatId AS destinationChatId
       FROM Publication
       INNER JOIN WorkflowDestination ON WorkflowDestination.id = Publication.destinationId
       ORDER BY COALESCE(sentAt, '') DESC, Publication.id DESC`,
    );
  }

  getPublication(id: number) {
    const publication = this.databaseService.get(
      `SELECT Publication.*, WorkflowDestination.title AS destinationTitle, WorkflowDestination.telegramChatId AS destinationChatId
       FROM Publication
       INNER JOIN WorkflowDestination ON WorkflowDestination.id = Publication.destinationId
       WHERE Publication.id = ?`,
      [id],
    );

    if (!publication) {
      throw new NotFoundException('Publication was not found.');
    }

    return publication;
  }

  recordPublication(draftId: number, destinationId: number, telegramMessageId: string | null, success: boolean, errorMessage?: string | null) {
    const sentAt = success ? new Date().toISOString() : null;
    const result = this.databaseService.run(
      `INSERT INTO Publication (draftId, destinationId, telegramMessageId, status, sentAt, errorMessage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        draftId,
        destinationId,
        telegramMessageId,
        success ? PublicationStatus.Sent : PublicationStatus.Failed,
        sentAt,
        errorMessage ?? null,
      ],
    );

    return this.getPublication(result.lastInsertRowid);
  }
}
