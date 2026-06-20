'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { handleClientError } from '@/lib/handle-client-error';
import type { AiProvider, AppSettings } from '@/types/api';
import { updateSettings } from '@/services/settings';

export function SettingsManager({ initialSettings, providers }: { initialSettings: AppSettings; providers: AiProvider[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    appName: initialSettings.appName,
    timezone: initialSettings.timezone,
    locale: initialSettings.locale,
    defaultLanguage: initialSettings.defaultLanguage,
    authMode: initialSettings.authMode,
    password: '',
    sessionDurationMinutes: initialSettings.sessionDurationMinutes,
    defaultAiProviderId: initialSettings.defaultAiProviderId ? String(initialSettings.defaultAiProviderId) : '',
    defaultSchedulingCron: initialSettings.defaultSchedulingCron ?? '',
    ownerTelegramChatId: initialSettings.ownerTelegramChatId ?? '',
    telegramBotUsername: initialSettings.telegramBotUsername ?? '',
  });
  const [status, setStatus] = useState('Update global defaults, owner chat routing, and authentication behavior.');

  async function handleSave() {
    setStatus('Saving settings...');
    try {
      await updateSettings({
        ...form,
        sessionDurationMinutes: Number(form.sessionDurationMinutes),
        defaultAiProviderId: form.defaultAiProviderId ? Number(form.defaultAiProviderId) : null,
        defaultSchedulingCron: form.defaultSchedulingCron || null,
        password: form.password || undefined,
        ownerTelegramChatId: form.ownerTelegramChatId || null,
        telegramBotUsername: form.telegramBotUsername || null,
      });
      setStatus('Settings saved.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Settings save failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Configuration" title="Settings" description="Global application defaults, authentication mode, locale, and owner runtime configuration." />
      <FormSection title="Global defaults" description={status}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="Application name"><Input value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} /></FormField>
          <FormField label="Timezone"><Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></FormField>
          <FormField label="Locale"><Select value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}><option value="en">English (`en`)</option><option value="fa">Persian (`fa`)</option><option value="ar">Arabic (`ar`)</option></Select></FormField>
          <FormField label="Default language"><Select value={form.defaultLanguage} onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })}><option value="English">English</option><option value="Persian">Persian</option><option value="Arabic">Arabic</option></Select></FormField>
          <FormField label="Authentication mode"><Select value={form.authMode} onChange={(event) => setForm({ ...form, authMode: event.target.value })}><option value="password">Password</option><option value="telegram-otp">Telegram OTP</option></Select></FormField>
          <FormField label="Owner password" helper="Leave blank to keep the current password."><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></FormField>
          <FormField label="Session duration (minutes)"><Select value={String(form.sessionDurationMinutes)} onChange={(event) => setForm({ ...form, sessionDurationMinutes: Number(event.target.value) })}><option value="60">60 minutes</option><option value="240">4 hours</option><option value="720">12 hours</option><option value="1440">24 hours</option></Select></FormField>
          <FormField label="Default AI provider"><Select value={form.defaultAiProviderId} onChange={(event) => setForm({ ...form, defaultAiProviderId: event.target.value })}><option value="">None</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select></FormField>
          <FormField label="Default schedule cron"><Input value={form.defaultSchedulingCron} onChange={(event) => setForm({ ...form, defaultSchedulingCron: event.target.value })} /></FormField>
          <FormField label="Owner Telegram chat ID"><Input value={form.ownerTelegramChatId} onChange={(event) => setForm({ ...form, ownerTelegramChatId: event.target.value })} /></FormField>
          <FormField label="Telegram bot username"><Input value={form.telegramBotUsername} onChange={(event) => setForm({ ...form, telegramBotUsername: event.target.value })} /></FormField>
        </div>
        <div className="flex justify-end"><Button onClick={() => void handleSave()}>Save settings</Button></div>
      </FormSection>
    </div>
  );
}
