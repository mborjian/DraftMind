import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import {
  APP_SETTINGS_ID,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_TEMPERATURE,
  DEFAULT_AI_TIMEOUT_SECONDS,
  DEFAULT_SESSION_DURATION_MINUTES,
  DEFAULT_SYSTEM_PROMPT_NAME,
  DEFAULT_SYSTEM_PROMPT_VERSION,
  SECRETS_ID,
} from '../common/constants/app.constants';
import { AuthMode } from '../common/enums/auth-mode.enum';
import { resolveFromWorkspaceRoot } from '../common/utils/workspace-path.util';

export type SqlParams = Array<string | number | null>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private database!: DatabaseSync;

  onModuleInit(): void {
    const databasePath = this.resolveDatabasePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA synchronous = NORMAL;');
    this.migrate();
    this.seedDefaults();
    this.logger.log(`SQLite database ready at ${databasePath}`);
  }

  onModuleDestroy(): void {
    this.database?.close();
  }

  run(sql: string, params: SqlParams = []): { changes: number; lastInsertRowid: number } {
    const statement = this.prepare(sql);
    const result = statement.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    };
  }

  get<T>(sql: string, params: SqlParams = []): T | undefined {
    return this.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: SqlParams = []): T[] {
    return this.prepare(sql).all(...params) as T[];
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  transaction<T>(callback: () => T): T {
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback();
      this.database.exec('COMMIT;');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  private prepare(sql: string): StatementSync {
    return this.database.prepare(sql);
  }

  private resolveDatabasePath(): string {
    const configuredPath = process.env.DATABASE_PATH?.trim();
    if (!configuredPath) {
      return resolveFromWorkspaceRoot('data', 'app.db');
    }

    return path.isAbsolute(configuredPath)
      ? configuredPath
      : resolveFromWorkspaceRoot(configuredPath.replace(/^\.\//, ''));
  }

  private migrate(): void {
    this.exec(`
      CREATE TABLE IF NOT EXISTS AppSettings (
        id INTEGER PRIMARY KEY,
        appName TEXT NOT NULL,
        timezone TEXT NOT NULL,
        locale TEXT NOT NULL,
        defaultLanguage TEXT NOT NULL,
        authMode TEXT NOT NULL,
        passwordHash TEXT NULL,
        sessionDurationMinutes INTEGER NOT NULL,
        defaultAiProviderId INTEGER NULL,
        defaultSchedulingCron TEXT NULL,
        ownerTelegramChatId TEXT NULL,
        telegramBotUsername TEXT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Secrets (
        id INTEGER PRIMARY KEY,
        telegramApiId INTEGER NULL,
        telegramApiHashEncrypted TEXT NULL,
        telegramSessionEncrypted TEXT NULL,
        telegramBotTokenEncrypted TEXT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS AIProvider (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        providerType TEXT NOT NULL DEFAULT 'openai-compatible',
        baseUrl TEXT NOT NULL,
        apiKeyEncrypted TEXT NULL,
        model TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        timeoutSeconds INTEGER NOT NULL DEFAULT ${DEFAULT_AI_TIMEOUT_SECONDS},
        maxTokens INTEGER NOT NULL DEFAULT ${DEFAULT_AI_MAX_TOKENS},
        temperature REAL NOT NULL DEFAULT ${DEFAULT_AI_TEMPERATURE},
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS AiPreferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        language TEXT NOT NULL,
        tone TEXT NOT NULL,
        formality INTEGER NOT NULL,
        harshness INTEGER NOT NULL,
        softness INTEGER NOT NULL,
        creativity INTEGER NOT NULL,
        bravery INTEGER NOT NULL,
        professionalism INTEGER NOT NULL,
        emotionalIntensity INTEGER NOT NULL,
        readingLevel TEXT NOT NULL,
        audienceType TEXT NOT NULL,
        technicalDepth INTEGER NOT NULL,
        storytelling INTEGER NOT NULL,
        persuasiveness INTEGER NOT NULL,
        objectivity INTEGER NOT NULL,
        seoEnabled INTEGER NOT NULL DEFAULT 0,
        hashtagsEnabled INTEGER NOT NULL DEFAULT 0,
        markdownEnabled INTEGER NOT NULL DEFAULT 1,
        callToActionEnabled INTEGER NOT NULL DEFAULT 0,
        emojiLevel INTEGER NOT NULL DEFAULT 0,
        sentenceLength TEXT NOT NULL,
        paragraphLength TEXT NOT NULL,
        brandConsistency INTEGER NOT NULL DEFAULT 50,
        customPreferencesJson TEXT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS SystemPrompt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Workflow (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        cronExpression TEXT NOT NULL,
        timezone TEXT NOT NULL,
        publishMode TEXT NOT NULL,
        publishIntervalMinutes INTEGER NOT NULL DEFAULT 0,
        aiProviderId INTEGER NULL,
        aiPreferencesId INTEGER NULL,
        userPrompt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT NULL,
        FOREIGN KEY (aiProviderId) REFERENCES AIProvider(id),
        FOREIGN KEY (aiPreferencesId) REFERENCES AiPreferences(id)
      );

      CREATE TABLE IF NOT EXISTS WorkflowState (
        workflowId INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        lastRunAt TEXT NULL,
        nextRunAt TEXT NULL,
        currentExecutionId INTEGER NULL,
        lastSuccessfulRunAt TEXT NULL,
        lastError TEXT NULL,
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS WorkflowSource (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflowId INTEGER NOT NULL,
        telegramChatId TEXT NOT NULL,
        title TEXT NOT NULL,
        username TEXT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS WorkflowDestination (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflowId INTEGER NOT NULL,
        telegramChatId TEXT NOT NULL,
        title TEXT NOT NULL,
        username TEXT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS WorkflowExecution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflowId INTEGER NOT NULL,
        startedAt TEXT NOT NULL,
        finishedAt TEXT NULL,
        status TEXT NOT NULL,
        collectedMessageCount INTEGER NOT NULL DEFAULT 0,
        detectedTopicCount INTEGER NOT NULL DEFAULT 0,
        selectedTopicCount INTEGER NOT NULL DEFAULT 0,
        generatedDraftCount INTEGER NOT NULL DEFAULT 0,
        publishedDraftCount INTEGER NOT NULL DEFAULT 0,
        totalTokens INTEGER NOT NULL DEFAULT 0,
        estimatedCost REAL NOT NULL DEFAULT 0,
        errorMessage TEXT NULL,
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS TelegramMessage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executionId INTEGER NOT NULL,
        workflowId INTEGER NOT NULL,
        telegramChatId TEXT NOT NULL,
        telegramMessageId TEXT NOT NULL,
        senderName TEXT NULL,
        messageText TEXT NOT NULL,
        sentAt TEXT NOT NULL,
        collectedAt TEXT NOT NULL,
        FOREIGN KEY (executionId) REFERENCES WorkflowExecution(id),
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS Topic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executionId INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        importanceScore REAL NOT NULL,
        confidenceScore REAL NOT NULL,
        sourceMessageCount INTEGER NOT NULL,
        approved INTEGER NOT NULL DEFAULT 0,
        rejected INTEGER NOT NULL DEFAULT 0,
        regenerated INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        deletedAt TEXT NULL,
        FOREIGN KEY (executionId) REFERENCES WorkflowExecution(id)
      );

      CREATE TABLE IF NOT EXISTS TopicSourceMessage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topicId INTEGER NOT NULL,
        telegramMessageId INTEGER NOT NULL,
        FOREIGN KEY (topicId) REFERENCES Topic(id),
        FOREIGN KEY (telegramMessageId) REFERENCES TelegramMessage(id)
      );

      CREATE TABLE IF NOT EXISTS Draft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topicId INTEGER NOT NULL UNIQUE,
        workflowId INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        manuallyEdited INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        scheduledFor TEXT NULL,
        publishedAt TEXT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT NULL,
        FOREIGN KEY (topicId) REFERENCES Topic(id),
        FOREIGN KEY (workflowId) REFERENCES Workflow(id)
      );

      CREATE TABLE IF NOT EXISTS Publication (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draftId INTEGER NOT NULL,
        destinationId INTEGER NOT NULL,
        telegramMessageId TEXT NULL,
        status TEXT NOT NULL,
        sentAt TEXT NULL,
        errorMessage TEXT NULL,
        FOREIGN KEY (draftId) REFERENCES Draft(id),
        FOREIGN KEY (destinationId) REFERENCES WorkflowDestination(id)
      );

      CREATE TABLE IF NOT EXISTS AIRequestLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executionId INTEGER NULL,
        workflowId INTEGER NULL,
        providerId INTEGER NULL,
        purpose TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        inputTokens INTEGER NOT NULL DEFAULT 0,
        outputTokens INTEGER NOT NULL DEFAULT 0,
        totalTokens INTEGER NOT NULL DEFAULT 0,
        estimatedCost REAL NOT NULL DEFAULT 0,
        latencyMs INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (executionId) REFERENCES WorkflowExecution(id),
        FOREIGN KEY (workflowId) REFERENCES Workflow(id),
        FOREIGN KEY (providerId) REFERENCES AIProvider(id)
      );

      CREATE TABLE IF NOT EXISTS LoginOtp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastSeenAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_enabled ON Workflow(enabled);
      CREATE INDEX IF NOT EXISTS idx_telegram_message_workflow_sent ON TelegramMessage(workflowId, sentAt);
      CREATE INDEX IF NOT EXISTS idx_topic_execution ON Topic(executionId);
      CREATE INDEX IF NOT EXISTS idx_draft_status ON Draft(status);
      CREATE INDEX IF NOT EXISTS idx_publication_status ON Publication(status);
      CREATE INDEX IF NOT EXISTS idx_ai_request_log_created_at ON AIRequestLog(createdAt);
      CREATE INDEX IF NOT EXISTS idx_execution_workflow_started ON WorkflowExecution(workflowId, startedAt);
      CREATE INDEX IF NOT EXISTS idx_workflow_state_next_run ON WorkflowState(nextRunAt);
    `);
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();
    const appSettingsExists = this.get<{ id: number }>('SELECT id FROM AppSettings WHERE id = ?', [APP_SETTINGS_ID]);
    if (!appSettingsExists) {
      this.run(
        `INSERT INTO AppSettings (
          id, appName, timezone, locale, defaultLanguage, authMode, passwordHash,
          sessionDurationMinutes, defaultAiProviderId, defaultSchedulingCron, ownerTelegramChatId,
          telegramBotUsername, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          APP_SETTINGS_ID,
          'DraftMind',
          'UTC',
          'en',
          'English',
          AuthMode.Password,
          null,
          DEFAULT_SESSION_DURATION_MINUTES,
          null,
          '0 * * * *',
          null,
          null,
          now,
          now,
        ],
      );
    }

    const secretsExist = this.get<{ id: number }>('SELECT id FROM Secrets WHERE id = ?', [SECRETS_ID]);
    if (!secretsExist) {
      this.run(
        `INSERT INTO Secrets (
          id, telegramApiId, telegramApiHashEncrypted, telegramSessionEncrypted,
          telegramBotTokenEncrypted, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [SECRETS_ID, null, null, null, null, now, now],
      );
    }

    const systemPromptExists = this.get<{ id: number }>('SELECT id FROM SystemPrompt LIMIT 1');
    if (!systemPromptExists) {
      const promptPath = resolveFromWorkspaceRoot('docs', 'prompt.txt');
      const promptContent = existsSync(promptPath)
        ? readFileSync(promptPath, 'utf8')
        : 'You are the developer-controlled editorial system prompt for DraftMind.';
      this.run(
        'INSERT INTO SystemPrompt (name, content, enabled, version, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [DEFAULT_SYSTEM_PROMPT_NAME, promptContent, 1, DEFAULT_SYSTEM_PROMPT_VERSION, now],
      );
    }
  }
}
