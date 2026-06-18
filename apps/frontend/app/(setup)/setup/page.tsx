'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeading } from '@/components/common/section-heading';
import { handleClientError } from '@/lib/handle-client-error';
import { completeSetup } from '@/services/setup';

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Complete setup once, then continue with login and workflow configuration.');
  const [form, setForm] = useState({
    appName: 'DraftMind',
    timezone: 'UTC',
    locale: 'en',
    defaultLanguage: 'English',
    authMode: 'password',
    password: '',
    sessionDurationMinutes: '720',
    telegramApiId: '',
    telegramApiHash: '',
    telegramSession: '',
    telegramBotToken: '',
    ownerTelegramChatId: '',
    telegramBotUsername: '',
    providerName: 'Primary provider',
    providerType: 'openai-compatible',
    providerBaseUrl: 'https://api.openai.com/v1',
    providerModel: 'gpt-4.1-mini',
    providerApiKey: '',
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Saving setup...');

    try {
      await completeSetup({
        appName: form.appName,
        timezone: form.timezone,
        locale: form.locale,
        defaultLanguage: form.defaultLanguage,
        authMode: form.authMode,
        password: form.password || undefined,
        sessionDurationMinutes: Number(form.sessionDurationMinutes),
        telegramApiId: form.telegramApiId ? Number(form.telegramApiId) : null,
        telegramApiHash: form.telegramApiHash || null,
        telegramSession: form.telegramSession || null,
        telegramBotToken: form.telegramBotToken || null,
        ownerTelegramChatId: form.ownerTelegramChatId || null,
        telegramBotUsername: form.telegramBotUsername || null,
        aiProviders: [
          {
            name: form.providerName,
            providerType: form.providerType,
            baseUrl: form.providerBaseUrl,
            model: form.providerModel,
            apiKey: form.providerApiKey,
            timeoutSeconds: 60,
            maxTokens: 2048,
            temperature: 0.4,
          },
        ],
      });
      setStatus('Setup completed. Redirecting to login...');
      router.push('/login');
    } catch (error) {
      setStatus(handleClientError(error, router, 'Setup failed.'));
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <SectionHeading
        eyebrow="First launch"
        title="Setup wizard"
        description="Configure the single-owner deployment, Telegram credentials, and the primary AI provider before using DraftMind."
      />
      <form onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Application</h2>
          <Input value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} placeholder="Application name" />
          <Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="Timezone" />
          <Input value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} placeholder="Locale" />
          <Input value={form.defaultLanguage} onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })} placeholder="Default language" />
          <Input value={form.sessionDurationMinutes} onChange={(event) => setForm({ ...form, sessionDurationMinutes: event.target.value })} placeholder="Session duration (minutes)" />
          <Select value={form.authMode} onChange={(event) => setForm({ ...form, authMode: event.target.value })}>
            <option value="password">Password</option>
            <option value="telegram-otp">Telegram OTP</option>
          </Select>
          <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Owner password" />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Telegram and AI</h2>
          <Input value={form.telegramApiId} onChange={(event) => setForm({ ...form, telegramApiId: event.target.value })} placeholder="Telegram API ID" />
          <Input value={form.telegramApiHash} onChange={(event) => setForm({ ...form, telegramApiHash: event.target.value })} placeholder="Telegram API Hash" />
          <Textarea value={form.telegramSession} onChange={(event) => setForm({ ...form, telegramSession: event.target.value })} placeholder="Telegram session string" />
          <Input value={form.telegramBotToken} onChange={(event) => setForm({ ...form, telegramBotToken: event.target.value })} placeholder="Telegram bot token" />
          <Input value={form.ownerTelegramChatId} onChange={(event) => setForm({ ...form, ownerTelegramChatId: event.target.value })} placeholder="Owner Telegram chat ID" />
          <Input value={form.telegramBotUsername} onChange={(event) => setForm({ ...form, telegramBotUsername: event.target.value })} placeholder="Telegram bot username" />
          <Input value={form.providerName} onChange={(event) => setForm({ ...form, providerName: event.target.value })} placeholder="Provider name" />
          <Input value={form.providerType} onChange={(event) => setForm({ ...form, providerType: event.target.value })} placeholder="Provider type" />
          <Input value={form.providerBaseUrl} onChange={(event) => setForm({ ...form, providerBaseUrl: event.target.value })} placeholder="Base URL" />
          <Input value={form.providerModel} onChange={(event) => setForm({ ...form, providerModel: event.target.value })} placeholder="Model" />
          <Input value={form.providerApiKey} onChange={(event) => setForm({ ...form, providerApiKey: event.target.value })} placeholder="Provider API key" type="password" />
        </Card>

        <div className="lg:col-span-2 flex items-center justify-between gap-4 rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
          <p className="text-sm text-muted-foreground">{status}</p>
          <Button type="submit">Complete setup</Button>
        </div>
      </form>
    </main>
  );
}
