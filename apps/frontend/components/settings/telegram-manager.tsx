'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, RefreshCcw } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { handleClientError } from '@/lib/handle-client-error';
import type { TelegramStatus } from '@/types/api';
import { testTelegramApi, testTelegramBot, updateTelegram } from '@/services/telegram';

export function TelegramManager({ initialStatus }: { initialStatus: TelegramStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState('Update Telegram collection and bot credentials. Stored secrets remain encrypted.');
  const [form, setForm] = useState({
    telegramApiId: status.telegramApiId ? String(status.telegramApiId) : '',
    telegramApiHash: '',
    telegramSession: '',
    telegramBotToken: '',
    ownerTelegramChatId: status.ownerTelegramChatId ?? '',
    telegramBotUsername: status.telegramBotUsername ?? '',
  });

  async function handleSave() {
    setMessage('Saving Telegram configuration...');
    try {
      const next = await updateTelegram({
        telegramApiId: form.telegramApiId ? Number(form.telegramApiId) : null,
        telegramApiHash: form.telegramApiHash || null,
        telegramSession: form.telegramSession || null,
        telegramBotToken: form.telegramBotToken || null,
        ownerTelegramChatId: form.ownerTelegramChatId || null,
        telegramBotUsername: form.telegramBotUsername || null,
      });
      setStatus(next);
      setForm({ ...form, telegramApiHash: '', telegramSession: '', telegramBotToken: '' });
      setMessage('Telegram configuration saved.');
      router.refresh();
    } catch (error) {
      setMessage(handleClientError(error, router, 'Telegram configuration save failed.'));
    }
  }

  async function handleTest(kind: 'api' | 'bot') {
    setMessage(`Testing Telegram ${kind} connectivity...`);
    try {
      const result = kind === 'api' ? await testTelegramApi() : await testTelegramBot();
      setMessage(result.message);
    } catch (error) {
      setMessage(handleClientError(error, router, 'Telegram connectivity test failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Telegram" title="Integration" description="Manage the Telegram user-account collector and the owner-facing management bot." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">API credentials</p><Badge>{status.telegramApiConfigured ? 'Configured' : 'Missing'}</Badge></Card>
        <Card className="space-y-2"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">User session</p><Badge>{status.telegramSessionConfigured ? 'Stored' : 'Missing'}</Badge></Card>
        <Card className="space-y-2"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bot token</p><Badge>{status.telegramBotConfigured ? 'Configured' : 'Missing'}</Badge></Card>
        <Card className="space-y-2"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner chat</p><p className="text-sm font-medium">{status.ownerTelegramChatId ?? 'Not set'}</p></Card>
      </div>
      <FormSection title="Credentials" description={message}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Telegram API ID"><Input value={form.telegramApiId} onChange={(event) => setForm({ ...form, telegramApiId: event.target.value })} /></FormField>
          <FormField label="Telegram bot username"><Input value={form.telegramBotUsername} onChange={(event) => setForm({ ...form, telegramBotUsername: event.target.value })} /></FormField>
          <FormField label="Telegram API hash" helper="Leave blank to keep the currently stored value."><Input type="password" value={form.telegramApiHash} onChange={(event) => setForm({ ...form, telegramApiHash: event.target.value })} /></FormField>
          <FormField label="Telegram bot token" helper="Leave blank to keep the currently stored value."><Input type="password" value={form.telegramBotToken} onChange={(event) => setForm({ ...form, telegramBotToken: event.target.value })} /></FormField>
          <FormField label="Owner Telegram chat ID"><Input value={form.ownerTelegramChatId} onChange={(event) => setForm({ ...form, ownerTelegramChatId: event.target.value })} /></FormField>
          <FormField label="Saved user session" helper="Paste a reusable Telegram user-account session string if you need to replace the stored session."><Textarea value={form.telegramSession} onChange={(event) => setForm({ ...form, telegramSession: event.target.value })} /></FormField>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => void handleTest('api')}><RefreshCcw className="mr-2 h-4 w-4" />Test API</Button>
          <Button variant="ghost" onClick={() => void handleTest('bot')}><CheckCircle2 className="mr-2 h-4 w-4" />Test bot</Button>
          <Button onClick={() => void handleSave()}>Save Telegram settings</Button>
        </div>
      </FormSection>
    </div>
  );
}
