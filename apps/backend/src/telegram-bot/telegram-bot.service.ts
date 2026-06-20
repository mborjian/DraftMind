import { forwardRef, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { DatabaseService } from '../database/database.service';
import { DraftsService } from '../drafts/drafts.service';
import { LogsService } from '../logs/logs.service';
import { PublisherService } from '../publisher/publisher.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramApiService } from '../telegram-api/telegram-api.service';
import { TopicsService } from '../topics/topics.service';

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
}

interface DraftRow {
  id: number;
  title: string;
  body: string;
  status: string;
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Bot<Context> | null = null;
  private startedWithToken: string | null = null;
  private startingPromise: Promise<void> | null = null;

  constructor(
    private readonly telegramApiService: TelegramApiService,
    private readonly settingsService: SettingsService,
    private readonly topicsService: TopicsService,
    private readonly draftsService: DraftsService,
    @Inject(forwardRef(() => PublisherService))
    private readonly publisherService: PublisherService,
    private readonly logsService: LogsService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStarted();
  }

  async onModuleDestroy(): Promise<void> {
    this.shutdown();
  }

  async ensureStarted(): Promise<void> {
    const token = this.telegramApiService.getDecryptedBotToken();
    if (!token) {
      return;
    }

    if (this.bot && this.startedWithToken === token) {
      return;
    }

    if (this.startingPromise) {
      await this.startingPromise;
      return;
    }

    this.startingPromise = this.startBot(token);
    try {
      await this.startingPromise;
    } finally {
      this.startingPromise = null;
    }
  }

  shutdown(): void {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      this.startedWithToken = null;
    }
  }

  async sendOtpCode(chatId: string, code: string, expiresAt: string) {
    return this.sendMessage(chatId, `DraftMind login code: ${code}\nExpires at: ${expiresAt}`);
  }

  async sendTopicReviewRequest(chatId: string, topics: TopicRow[]) {
    await this.ensureStarted();
    const deliveries: Array<{ delivered: boolean; topicId: number }> = [];

    for (const topic of topics) {
      const keyboard = new InlineKeyboard()
        .text('Approve', `topic:approve:${topic.id}`)
        .text('Reject', `topic:reject:${topic.id}`)
        .row()
        .text('Regenerate', `topic:regenerate:${topic.id}`);

      const delivered = await this.sendMessage(
        chatId,
        [
          `Topic #${topic.id}`,
          `Title: ${topic.title}`,
          `Summary: ${topic.summary}`,
          `Importance: ${topic.importanceScore.toFixed(2)}`,
          `Confidence: ${topic.confidenceScore.toFixed(2)}`,
          `Supporting messages: ${topic.sourceMessageCount}`,
        ].join('\n'),
        keyboard,
      );

      deliveries.push({ delivered: delivered.delivered, topicId: topic.id });
    }

    return {
      delivered: deliveries.every((entry) => entry.delivered),
      deliveries,
    };
  }

  async sendDraftReviewRequest(chatId: string, draft: DraftRow) {
    const keyboard = new InlineKeyboard()
      .text('Save', `draft:save:${draft.id}`)
      .text('Publish', `draft:publish:${draft.id}`)
      .row()
      .text('Regenerate', `draft:regenerate:${draft.id}`);

    return this.sendMessage(
      chatId,
      [`Draft #${draft.id}`, `Title: ${draft.title}`, `Status: ${draft.status}`, '', draft.body].join('\n'),
      keyboard,
    );
  }

  async sendOperationalNotification(chatId: string, message: string) {
    return this.sendMessage(chatId, message);
  }

  async sendExecutionSummary(chatId: string, execution: {
    id: number;
    workflowName: string;
    status: string;
    collectedMessageCount: number;
    detectedTopicCount: number;
    generatedDraftCount: number;
    publishedDraftCount: number;
    estimatedCost: number;
  }) {
    return this.sendMessage(
      chatId,
      [
        `Execution #${execution.id} finished`,
        `Workflow: ${execution.workflowName}`,
        `Status: ${execution.status}`,
        `Collected messages: ${execution.collectedMessageCount}`,
        `Detected topics: ${execution.detectedTopicCount}`,
        `Generated drafts: ${execution.generatedDraftCount}`,
        `Published drafts: ${execution.publishedDraftCount}`,
        `Estimated AI cost: $${execution.estimatedCost.toFixed(4)}`,
      ].join('\n'),
    );
  }

  private async startBot(token: string): Promise<void> {
    this.shutdown();

    const bot = new Bot(token);
    bot.catch((error) => {
      const innerError = error.error instanceof Error ? error.error : new Error('Unknown Telegram bot middleware failure.');
      this.logsService.error(`Telegram bot middleware failure: ${innerError.message}`, innerError.stack, TelegramBotService.name);
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const settings = this.settingsService.getSettings();
      const chatId = String(ctx.chat.id);

      if (!settings.ownerTelegramChatId) {
        await this.settingsService.updateSettings({ ownerTelegramChatId: chatId });
      }

      if (text === '/start') {
        await ctx.reply('DraftMind bot is connected. This chat is used for owner approvals and notifications.');
      }
    });

    bot.on('callback_query:data', async (ctx) => {
      const ownerChatId = this.settingsService.getSettings().ownerTelegramChatId;
      if (!ownerChatId || String(ctx.callbackQuery.message?.chat.id ?? '') !== ownerChatId) {
        await ctx.answerCallbackQuery({ text: 'Unauthorized callback.', show_alert: true });
        return;
      }

      const data = ctx.callbackQuery.data ?? '';
      const [scope, action, rawId] = data.split(':');
      const id = Number(rawId);
      if (!scope || !action || Number.isNaN(id)) {
        await ctx.answerCallbackQuery({ text: 'Invalid callback payload.', show_alert: true });
        return;
      }

      try {
        if (scope === 'topic') {
          await this.handleTopicAction(action, id);
        }
        if (scope === 'draft') {
          await this.handleDraftAction(action, id);
        }
        await ctx.answerCallbackQuery({ text: 'Action applied.' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        await ctx.answerCallbackQuery({ text: message, show_alert: true });
      }
    });

    await bot.init();
    void bot.start({ drop_pending_updates: false, allowed_updates: ['message', 'callback_query'] });
    this.bot = bot;
    this.startedWithToken = token;
    this.logsService.info('Telegram management bot polling started.', TelegramBotService.name);
  }

  private async handleTopicAction(action: string, topicId: number): Promise<void> {
    if (action === 'approve') {
      const topic = await this.topicsService.approveTopic(topicId);
      if (topic.generatedDraftId) {
        const draft = this.databaseService.get<DraftRow>('SELECT id, title, body, status FROM Draft WHERE id = ?', [topic.generatedDraftId]);
        const chatId = this.settingsService.getSettings().ownerTelegramChatId;
        if (chatId && draft) {
          await this.sendDraftReviewRequest(chatId, draft);
        }
      }
      return;
    }
    if (action === 'reject') {
      await this.topicsService.rejectTopic(topicId);
      return;
    }
    if (action === 'regenerate') {
      const topics = await this.topicsService.regenerateTopic(topicId);
      const chatId = this.settingsService.getSettings().ownerTelegramChatId;
      if (chatId && Array.isArray(topics) && topics.length > 0) {
        await this.sendTopicReviewRequest(
          chatId,
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
      return;
    }
  }

  private async handleDraftAction(action: string, draftId: number): Promise<void> {
    if (action === 'save') {
      await this.draftsService.saveDraft(draftId);
      return;
    }
    if (action === 'publish') {
      await this.draftsService.publishDraft(draftId);
      return;
    }
    if (action === 'regenerate') {
      await this.draftsService.regenerateDraft(draftId);
    }
  }

  private async sendMessage(chatId: string, text: string, replyMarkup?: InlineKeyboard) {
    await this.ensureStarted();
    if (!this.bot) {
      return { delivered: false, chatId, preview: text.slice(0, 80) };
    }

    const message = await this.bot.api.sendMessage(chatId, text, {
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });

    return {
      delivered: true,
      chatId,
      messageId: String(message.message_id),
      preview: text.slice(0, 80),
    };
  }
}
