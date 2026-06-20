'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { handleClientError } from '@/lib/handle-client-error';
import { completeSetup, testSetupProvider } from '@/services/setup';

const steps = [
  {
    id: 'application',
    title: 'Application',
    description: 'Define the deployment identity, locale, and owner login mode.',
  },
  {
    id: 'telegram',
    title: 'Telegram',
    description: 'Add the collector account and management bot credentials.',
  },
  {
    id: 'provider',
    title: 'AI provider',
    description: 'Configure the primary provider used for topic detection and draft generation.',
  },
] as const;

export default function SetupPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<string>('Complete setup once, then continue with login and workflow configuration.');
  const [providerModels, setProviderModels] = useState<string[]>(['gpt-4.1-mini']);
  const [providerTested, setProviderTested] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
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
  const currentStep = steps[stepIndex] ?? steps[0];
  const isLastStep = stepIndex === steps.length - 1;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (stepIndex === 2 && !providerTested) {
      setStatus('Test the AI provider connection before completing setup so the model list can be confirmed.');
      return;
    }

    if (!isLastStep) {
      const nextStepIndex = Math.min(stepIndex + 1, steps.length - 1);
      const nextStep = steps[nextStepIndex];
      setStepIndex(nextStepIndex);
      setStatus(`Step ${nextStepIndex + 1} of ${steps.length}: ${nextStep ? nextStep.title : 'Setup'}.`);
      return;
    }

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

  async function handleProviderTest() {
    setTestingProvider(true);
    setStatus('Testing AI provider connection and loading models...');

    try {
      const result = await testSetupProvider({
        name: form.providerName,
        providerType: form.providerType,
        baseUrl: form.providerBaseUrl,
        model: form.providerModel,
        apiKey: form.providerApiKey,
        timeoutSeconds: 60,
      });

      const nextModels = result.models.length > 0 ? result.models : [form.providerModel];
      setProviderModels(nextModels);
      if (!nextModels.includes(form.providerModel)) {
        setForm((current) => ({ ...current, providerModel: nextModels[0] ?? current.providerModel }));
      }
      setProviderTested(true);
      setStatus(`Provider test succeeded with HTTP ${result.statusCode}. ${nextModels.length} model(s) available.`);
    } catch (error) {
      setProviderTested(false);
      setStatus(handleClientError(error, router, 'Provider test failed.'));
    } finally {
      setTestingProvider(false);
    }
  }

  function goToPreviousStep() {
    const previousStepIndex = Math.max(stepIndex - 1, 0);
    const previousStep = steps[previousStepIndex];
    setStepIndex(previousStepIndex);
    setStatus(`Step ${previousStepIndex + 1} of ${steps.length}: ${previousStep ? previousStep.title : 'Setup'}.`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <SectionHeading
        eyebrow="First launch"
        title="Setup wizard"
        description="Configure the single-owner deployment, Telegram credentials, and the primary AI provider before using DraftMind."
      />
      <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const state =
                index === stepIndex ? 'border-primary bg-primary/10 text-foreground' : index < stepIndex ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground' : 'border-border/70 bg-background/60 text-muted-foreground';
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`flex w-full items-start gap-3 rounded-3xl border px-4 py-4 text-left transition ${state}`}
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold">{step.title}</span>
                    <span className="block text-xs leading-5">{step.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <form onSubmit={onSubmit} className="grid gap-6">
          <FormSection
            title={`Step ${stepIndex + 1}: ${currentStep.title}`}
            description={currentStep.description}
          >
            {stepIndex === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Application name" helper="Shown in the UI and stored in global settings.">
                  <Input value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} placeholder="DraftMind" />
                </FormField>
                <FormField label="Timezone" helper="Use an IANA timezone such as `UTC` or `Asia/Tehran`.">
                  <Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="UTC" />
                </FormField>
                <FormField label="Locale" helper="Short UI locale used by the app.">
                  <Select value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
                    <option value="en">English (`en`)</option>
                    <option value="fa">Persian (`fa`)</option>
                    <option value="ar">Arabic (`ar`)</option>
                  </Select>
                </FormField>
                <FormField label="Default language" helper="Primary generation language for workflows.">
                  <Select value={form.defaultLanguage} onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })}>
                    <option value="English">English</option>
                    <option value="Persian">Persian</option>
                    <option value="Arabic">Arabic</option>
                  </Select>
                </FormField>
                <FormField label="Session duration (minutes)" helper="Controls owner session lifetime in the web UI.">
                  <Select value={form.sessionDurationMinutes} onChange={(event) => setForm({ ...form, sessionDurationMinutes: event.target.value })}>
                    <option value="60">60 minutes</option>
                    <option value="240">4 hours</option>
                    <option value="720">12 hours</option>
                    <option value="1440">24 hours</option>
                  </Select>
                </FormField>
                <FormField label="Authentication mode" helper="Choose static password or Telegram OTP for owner login.">
                  <Select value={form.authMode} onChange={(event) => setForm({ ...form, authMode: event.target.value })}>
                    <option value="password">Password</option>
                    <option value="telegram-otp">Telegram OTP</option>
                  </Select>
                </FormField>
                <FormField
                  label="Owner password"
                  helper={form.authMode === 'password' ? 'Required when password authentication is selected.' : 'Optional when using Telegram OTP.'}
                  className="md:col-span-2"
                >
                  <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Set the owner password" />
                </FormField>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Telegram API ID" helper="API ID for the single collector user account.">
                  <Input type="number" value={form.telegramApiId} onChange={(event) => setForm({ ...form, telegramApiId: event.target.value })} placeholder="1234567" inputMode="numeric" />
                </FormField>
                <FormField label="Telegram API hash" helper="Stored encrypted at rest.">
                  <Input type="password" value={form.telegramApiHash} onChange={(event) => setForm({ ...form, telegramApiHash: event.target.value })} placeholder="Telegram API hash" />
                </FormField>
                <FormField label="Owner Telegram chat ID" helper="Owner-only bot approvals and OTPs are delivered to this chat.">
                  <Input value={form.ownerTelegramChatId} onChange={(event) => setForm({ ...form, ownerTelegramChatId: event.target.value })} placeholder="123456789" />
                </FormField>
                <FormField label="Telegram bot username" helper="Optional but useful for verification and operator clarity.">
                  <Input value={form.telegramBotUsername} onChange={(event) => setForm({ ...form, telegramBotUsername: event.target.value })} placeholder="draftmind_bot" />
                </FormField>
                <FormField label="Telegram bot token" helper="Management bot token used for approvals, OTP, and notifications." className="md:col-span-2">
                  <Input value={form.telegramBotToken} onChange={(event) => setForm({ ...form, telegramBotToken: event.target.value })} placeholder="Telegram bot token" type="password" />
                </FormField>
                <FormField label="Telegram session string" helper="Paste an existing collector session if you already have one." className="md:col-span-2">
                  <Textarea value={form.telegramSession} onChange={(event) => setForm({ ...form, telegramSession: event.target.value })} placeholder="Telegram session string" />
                </FormField>
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Provider name" helper="Display name for the primary AI provider profile.">
                  <Input value={form.providerName} onChange={(event) => setForm({ ...form, providerName: event.target.value })} placeholder="Primary provider" />
                </FormField>
                <FormField label="Provider type" helper="Keep this aligned with the gateway abstraction, for example `openai-compatible`.">
                  <Select value={form.providerType} onChange={(event) => { setForm({ ...form, providerType: event.target.value }); setProviderTested(false); }}>
                    <option value="openai-compatible">OpenAI-compatible</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="self-hosted">Self-hosted compatible</option>
                  </Select>
                </FormField>
                <FormField label="Base URL" helper="Provider API base URL used by the backend AI gateway.">
                  <Input type="url" value={form.providerBaseUrl} onChange={(event) => { setForm({ ...form, providerBaseUrl: event.target.value }); setProviderTested(false); }} placeholder="https://api.openai.com/v1" />
                </FormField>
                <FormField label="Model" helper="Loaded from the provider after a successful connection test.">
                  <Select value={form.providerModel} onChange={(event) => setForm({ ...form, providerModel: event.target.value })}>
                    {providerModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Provider API key" helper="Stored encrypted and not returned in plaintext after setup." className="md:col-span-2">
                  <Input value={form.providerApiKey} onChange={(event) => { setForm({ ...form, providerApiKey: event.target.value }); setProviderTested(false); }} placeholder="Provider API key" type="password" />
                </FormField>
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/50 px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    {providerTested ? 'Connection verified. You can now choose from the discovered model list.' : 'Test the provider to verify credentials and load available models.'}
                  </p>
                  <Button type="button" variant="secondary" onClick={() => void handleProviderTest()} disabled={testingProvider}>
                    {testingProvider ? 'Testing...' : 'Test connection'}
                  </Button>
                </div>
              </div>
            ) : null}
          </FormSection>

          <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={goToPreviousStep} disabled={stepIndex === 0}>
                Back
              </Button>
              <Button type="submit">{isLastStep ? 'Complete setup' : 'Continue'}</Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
