import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { BadRequestException, Injectable } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateTelegramDto } from './dto/update-telegram.dto';

interface SecretsRow {
  id: number;
  telegramApiId: number | null;
  telegramApiHashEncrypted: string | null;
  telegramSessionEncrypted: string | null;
  telegramBotTokenEncrypted: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowSourceRow {
  id: number;
  workflowId: number;
  telegramChatId: string;
  title: string;
  username: string | null;
  type: string;
}

interface TelegramMessageRow {
  id: number;
  executionId: number;
  workflowId: number;
  telegramChatId: string;
  telegramMessageId: string;
  senderName: string | null;
  messageText: string;
  sentAt: string;
  collectedAt: string;
}

export interface CollectedTelegramMessage {
  id: number;
  executionId: number;
  workflowId: number;
  telegramChatId: string;
  telegramMessageId: string;
  senderName: string | null;
  messageText: string;
  sentAt: string;
  collectedAt: string;
}

@Injectable()
export class TelegramApiService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsService: SecretsService,
    private readonly settingsService: SettingsService,
  ) {}

  getTelegramStatus() {
    const secrets = this.databaseService.get<SecretsRow>('SELECT * FROM Secrets WHERE id = 1');
    const settings = this.settingsService.getSettings();

    return {
      telegramApiConfigured: Boolean(secrets?.telegramApiId && secrets?.telegramApiHashEncrypted),
      telegramSessionConfigured: Boolean(secrets?.telegramSessionEncrypted),
      telegramBotConfigured: Boolean(secrets?.telegramBotTokenEncrypted),
      telegramApiId: secrets?.telegramApiId ?? null,
      ownerTelegramChatId: settings.ownerTelegramChatId,
      telegramBotUsername: settings.telegramBotUsername,
    };
  }

  updateTelegramConfiguration(dto: UpdateTelegramDto) {
    const current = this.databaseService.get<SecretsRow>('SELECT * FROM Secrets WHERE id = 1');
    this.databaseService.run(
      `UPDATE Secrets SET telegramApiId = ?, telegramApiHashEncrypted = ?, telegramSessionEncrypted = ?,
        telegramBotTokenEncrypted = ?, updatedAt = ? WHERE id = 1`,
      [
        dto.telegramApiId ?? current?.telegramApiId ?? null,
        dto.telegramApiHash ? this.secretsService.encrypt(dto.telegramApiHash) : current?.telegramApiHashEncrypted ?? null,
        dto.telegramSession ? this.secretsService.encrypt(dto.telegramSession) : current?.telegramSessionEncrypted ?? null,
        dto.telegramBotToken ? this.secretsService.encrypt(dto.telegramBotToken) : current?.telegramBotTokenEncrypted ?? null,
        new Date().toISOString(),
      ],
    );

    this.settingsService.updateSettings({
      ownerTelegramChatId: dto.ownerTelegramChatId,
      telegramBotUsername: dto.telegramBotUsername,
    });

    return this.getTelegramStatus();
  }

  async testApiConnectivity() {
    await this.withClient(async (client) => {
      await client.getMe();
    });

    return {
      success: true,
      message: 'Telegram user-account session is authenticated and can reach the Telegram API.',
    };
  }

  async testBotConnectivity() {
    const token = this.getDecryptedBotToken();
    if (!token) {
      return {
        success: false,
        message: 'Telegram bot token is incomplete.',
      };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: 'Telegram bot token could not be verified.',
      };
    }

    const payload = (await response.json()) as { ok?: boolean };
    return {
      success: payload.ok === true,
      message: payload.ok === true ? 'Telegram bot token is valid.' : 'Telegram bot token could not be verified.',
    };
  }

  getDecryptedBotToken(): string | null {
    const secrets = this.databaseService.get<SecretsRow>('SELECT telegramBotTokenEncrypted FROM Secrets WHERE id = 1');
    return this.secretsService.decrypt(secrets?.telegramBotTokenEncrypted ?? null);
  }

  getDecryptedApiCredentials(): { apiId: number; apiHash: string; session: string } {
    const secrets = this.databaseService.get<SecretsRow>('SELECT * FROM Secrets WHERE id = 1');
    const apiId = secrets?.telegramApiId ?? null;
    const apiHash = this.secretsService.decrypt(secrets?.telegramApiHashEncrypted ?? null);
    const session = this.secretsService.decrypt(secrets?.telegramSessionEncrypted ?? null);

    if (!apiId || !apiHash || !session) {
      throw new BadRequestException('Telegram API credentials or session are incomplete.');
    }

    return {
      apiId,
      apiHash,
      session,
    };
  }

  async collectWorkflowMessages(input: {
    workflowId: number;
    executionId: number;
    windowStart: string;
    windowEnd: string;
  }): Promise<CollectedTelegramMessage[]> {
    const sources = this.databaseService.all<WorkflowSourceRow>(
      'SELECT id, workflowId, telegramChatId, title, username, type FROM WorkflowSource WHERE workflowId = ?',
      [input.workflowId],
    );

    if (sources.length === 0) {
      return [];
    }

    const minTimestampSeconds = Math.floor(new Date(input.windowStart).getTime() / 1000);
    const maxTimestampMilliseconds = new Date(input.windowEnd).getTime();
    const collectedAt = new Date().toISOString();
    const persisted: CollectedTelegramMessage[] = [];

    await this.withClient(async (client) => {
      for (const source of sources) {
        const entity = await client.getInputEntity(this.resolveEntityKey(source));
        for await (const message of client.iterMessages(entity, { reverse: true, minId: 0 })) {
          const typedMessage = message as Api.Message;
          const sentAtMs = (typedMessage.date ?? 0) * 1000;
          if (!sentAtMs || sentAtMs < minTimestampSeconds * 1000) {
            continue;
          }
          if (sentAtMs > maxTimestampMilliseconds) {
            continue;
          }

          const normalized = this.normalizeMessage(typedMessage, source.telegramChatId);
          if (!normalized) {
            continue;
          }

          const existing = this.databaseService.get<{ id: number }>(
            `SELECT id FROM TelegramMessage
             WHERE workflowId = ? AND executionId = ? AND telegramChatId = ? AND telegramMessageId = ?`,
            [input.workflowId, input.executionId, normalized.telegramChatId, normalized.telegramMessageId],
          );

          if (existing) {
            continue;
          }

          const insert = this.databaseService.run(
            `INSERT INTO TelegramMessage (
              executionId, workflowId, telegramChatId, telegramMessageId, senderName, messageText, sentAt, collectedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              input.executionId,
              input.workflowId,
              normalized.telegramChatId,
              normalized.telegramMessageId,
              normalized.senderName,
              normalized.messageText,
              normalized.sentAt,
              collectedAt,
            ],
          );

          persisted.push({
            id: insert.lastInsertRowid,
            executionId: input.executionId,
            workflowId: input.workflowId,
            telegramChatId: normalized.telegramChatId,
            telegramMessageId: normalized.telegramMessageId,
            senderName: normalized.senderName,
            messageText: normalized.messageText,
            sentAt: normalized.sentAt,
            collectedAt,
          });
        }
      }
    });

    return persisted;
  }

  getExecutionMessages(executionId: number): TelegramMessageRow[] {
    return this.databaseService.all<TelegramMessageRow>(
      `SELECT id, executionId, workflowId, telegramChatId, telegramMessageId, senderName, messageText, sentAt, collectedAt
       FROM TelegramMessage WHERE executionId = ? ORDER BY sentAt ASC, id ASC`,
      [executionId],
    );
  }

  getTopicSourceMessages(topicId: number): TelegramMessageRow[] {
    return this.databaseService.all<TelegramMessageRow>(
      `SELECT TelegramMessage.id, TelegramMessage.executionId, TelegramMessage.workflowId, TelegramMessage.telegramChatId,
              TelegramMessage.telegramMessageId, TelegramMessage.senderName, TelegramMessage.messageText,
              TelegramMessage.sentAt, TelegramMessage.collectedAt
       FROM TopicSourceMessage
       INNER JOIN TelegramMessage ON TelegramMessage.id = TopicSourceMessage.telegramMessageId
       WHERE TopicSourceMessage.topicId = ?
       ORDER BY TelegramMessage.sentAt ASC, TelegramMessage.id ASC`,
      [topicId],
    );
  }

  private resolveEntityKey(source: WorkflowSourceRow): string {
    if (source.username?.trim()) {
      return source.username.startsWith('@') ? source.username : `@${source.username}`;
    }

    return source.telegramChatId;
  }

  private normalizeMessage(message: Api.Message, fallbackChatId: string): Omit<CollectedTelegramMessage, 'id' | 'executionId' | 'workflowId' | 'collectedAt'> | null {
    const messageText = this.normalizeText(message.message ?? '');
    if (!messageText) {
      return null;
    }

    if (message.media || message.action) {
      return null;
    }

    const sentAtSeconds = message.date ?? 0;
    if (!sentAtSeconds) {
      return null;
    }

    const peerChatId = this.extractPeerChatId(message.peerId) ?? fallbackChatId;
    return {
      telegramChatId: peerChatId,
      telegramMessageId: String(message.id),
      senderName: this.extractSenderName(message),
      messageText,
      sentAt: new Date(sentAtSeconds * 1000).toISOString(),
    };
  }

  private normalizeText(value: string): string {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractSenderName(message: Api.Message): string | null {
    const sender = message.sender;
    if (!sender) {
      return null;
    }

    if ('firstName' in sender || 'lastName' in sender) {
      const firstName = 'firstName' in sender && typeof sender.firstName === 'string' ? sender.firstName : '';
      const lastName = 'lastName' in sender && typeof sender.lastName === 'string' ? sender.lastName : '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        return fullName;
      }
    }

    if ('title' in sender && typeof sender.title === 'string' && sender.title.trim()) {
      return sender.title.trim();
    }

    if ('username' in sender && typeof sender.username === 'string' && sender.username.trim()) {
      return sender.username.trim();
    }

    return null;
  }

  private extractPeerChatId(peer: Api.TypePeer | undefined): string | null {
    if (!peer) {
      return null;
    }

    if (peer instanceof Api.PeerChannel) {
      return String(peer.channelId);
    }
    if (peer instanceof Api.PeerChat) {
      return String(peer.chatId);
    }
    if (peer instanceof Api.PeerUser) {
      return null;
    }

    return null;
  }

  private async withClient<T>(handler: (client: TelegramClient) => Promise<T>): Promise<T> {
    const credentials = this.getDecryptedApiCredentials();
    const client = new TelegramClient(new StringSession(credentials.session), credentials.apiId, credentials.apiHash, {
      connectionRetries: 3,
      useWSS: false,
    });

    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) {
      await client.disconnect();
      throw new BadRequestException('The stored Telegram user-account session is no longer authorized.');
    }

    try {
      return await handler(client);
    } finally {
      await client.disconnect();
    }
  }
}
