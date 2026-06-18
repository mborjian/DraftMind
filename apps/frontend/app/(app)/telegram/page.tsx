import { serverApiRequest } from '@/lib/server-api';
import type { TelegramStatus } from '@/types/api';
import { TelegramManager } from '@/components/settings/telegram-manager';

export default async function TelegramPage() {
  const status = await serverApiRequest<TelegramStatus>('/telegram').catch(() => ({
    telegramApiConfigured: false,
    telegramSessionConfigured: false,
    telegramBotConfigured: false,
    telegramApiId: null,
    ownerTelegramChatId: null,
    telegramBotUsername: null,
  }));

  return <TelegramManager initialStatus={status} />;
}
