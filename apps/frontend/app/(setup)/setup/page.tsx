'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, CircleHelp, Eye, EyeOff, MessageSquareMore, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { TimezoneCombobox } from '@/components/forms/timezone-combobox';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { InlineToast } from '@/components/ui/toast';
import { handleClientError } from '@/lib/handle-client-error';
import { isValidTimezone, normalizeTimezoneInput } from '@/lib/timezones';
import {
  completeSetup,
  sendSetupOtpTest,
  testSetupProvider,
  testSetupTelegramApi,
  testSetupTelegramBot,
  verifySetupOtpTest,
} from '@/services/setup';

const steps = [
  {
    id: 'application',
    title: 'Application',
    description: 'Define the deployment identity and runtime timezone.',
  },
  {
    id: 'telegram',
    title: 'Telegram',
    description: 'Configure the owner chat and the management bot credentials.',
  },
  {
    id: 'provider',
    title: 'AI provider',
    description: 'Configure the primary provider endpoint and validate connectivity.',
  },
  {
    id: 'auth',
    title: 'Auth',
    description: 'Choose whether the deployment needs no auth, password login, or Telegram OTP.',
  },
] as const;

const providerOptions = [
  { value: 'gemini', label: 'Gemini API key' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'lm-studio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
] as const;

const authOptions = [
  { value: 'none', label: 'No auth' },
  { value: 'password', label: 'Password' },
  { value: 'telegram-otp', label: 'Telegram OTP' },
] as const;

function getProviderDefaults(providerType: string) {
  switch (providerType) {
    case 'gemini':
      return { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', showBaseUrl: false, showApiKey: true };
    case 'anthropic':
      return { baseUrl: 'https://api.anthropic.com', showBaseUrl: false, showApiKey: true };
    case 'openai':
      return { baseUrl: 'https://api.openai.com/v1', showBaseUrl: false, showApiKey: true };
    case 'lm-studio':
      return { baseUrl: 'http://localhost:1234', showBaseUrl: true, showApiKey: false };
    case 'ollama':
      return { baseUrl: 'http://localhost:11434', showBaseUrl: true, showApiKey: false };
    default:
      return { baseUrl: 'https://api.openai.com/v1', showBaseUrl: true, showApiKey: true };
  }
}

export default function SetupPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<string>('Complete the initial setup once. After that, the wizard will stay hidden.');
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiHash, setShowApiHash] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showProviderApiKey, setShowProviderApiKey] = useState(false);
  const [providerTested, setProviderTested] = useState(false);
  const [telegramApiTested, setTelegramApiTested] = useState(false);
  const [telegramBotTested, setTelegramBotTested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [testingTelegramApi, setTestingTelegramApi] = useState(false);
  const [testingTelegramBot, setTestingTelegramBot] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [form, setForm] = useState({
    appName: 'DraftMind',
    timezone: 'UTC',
    telegramApiId: '',
    telegramApiHash: '',
    telegramBotToken: '',
    ownerTelegramChatId: '',
    telegramBotUsername: '',
    providerType: 'openai',
    providerBaseUrl: 'https://api.openai.com/v1',
    providerApiKey: '',
    authMode: 'none',
    password: '',
    otpCode: '',
  });

  const currentStep = steps[stepIndex] ?? steps[0];
  const isLastStep = stepIndex === steps.length - 1;
  const providerRules = getProviderDefaults(form.providerType);

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!form.appName.trim()) {
      errors.appName = 'Application name is required.';
    }
    if (!isValidTimezone(form.timezone)) {
      errors.timezone = 'Choose an IANA timezone or type a numeric UTC offset like UTC+01:00.';
    }
    if (!form.telegramApiId.trim()) {
      errors.telegramApiId = 'Telegram API ID is required.';
    }
    if (!form.telegramApiHash.trim()) {
      errors.telegramApiHash = 'Telegram API hash is required.';
    }
    if (!form.ownerTelegramChatId.trim()) {
      errors.ownerTelegramChatId = 'Owner Telegram chat ID is required.';
    }
    if (!form.telegramBotUsername.trim()) {
      errors.telegramBotUsername = 'Telegram bot username is required.';
    }
    if (!form.telegramBotToken.trim()) {
      errors.telegramBotToken = 'Telegram bot token is required.';
    }
    if (providerRules.showBaseUrl && !form.providerBaseUrl.trim()) {
      errors.providerBaseUrl = 'Base URL is required for this provider.';
    }
    if (providerRules.showApiKey && !form.providerApiKey.trim()) {
      errors.providerApiKey = 'Provider API key is required for this provider.';
    }
    if (form.authMode === 'password' && !form.password.trim()) {
      errors.password = 'Password is required for password auth.';
    }
    if (form.authMode === 'telegram-otp' && !form.otpCode.trim() && !otpVerified) {
      errors.otpCode = 'Send and verify an OTP test before completing setup.';
    }

    const stepValidities = [
      !errors.appName && !errors.timezone,
      !errors.telegramApiId && !errors.telegramApiHash && !errors.ownerTelegramChatId && !errors.telegramBotUsername && !errors.telegramBotToken && telegramApiTested && telegramBotTested,
      !errors.providerBaseUrl && !errors.providerApiKey && providerTested,
      form.authMode === 'none' || (form.authMode === 'password' ? !errors.password : otpVerified),
    ];

    return {
      errors,
      stepValidities,
      currentStepValid: stepValidities[stepIndex] ?? false,
    };
  }, [
    form,
    otpVerified,
    providerRules.showApiKey,
    providerRules.showBaseUrl,
    providerTested,
    stepIndex,
    telegramApiTested,
    telegramBotTested,
  ]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    if (key === 'telegramApiId' || key === 'telegramApiHash') {
      setTelegramApiTested(false);
    }

    if (key === 'telegramBotToken' || key === 'ownerTelegramChatId' || key === 'telegramBotUsername') {
      setTelegramBotTested(false);
      setOtpVerified(false);
    }

    if (key === 'providerApiKey' || key === 'providerBaseUrl') {
      setProviderTested(false);
    }

    if (key === 'authMode') {
      setOtpVerified(false);
    }

    if (key === 'otpCode') {
      setOtpVerified(false);
    }

    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProviderType(nextType: string) {
    const defaults = getProviderDefaults(nextType);
    setForm((current) => ({
      ...current,
      providerType: nextType,
      providerBaseUrl: defaults.baseUrl,
    }));
    setProviderTested(false);
  }

  async function handleProviderTest() {
    setTestingProvider(true);
    setStatus('Testing the AI provider connection...');
    try {
      const result = await testSetupProvider({
        providerType: form.providerType,
        baseUrl: providerRules.showBaseUrl ? form.providerBaseUrl : providerRules.baseUrl,
        apiKey: providerRules.showApiKey ? form.providerApiKey : undefined,
        timeoutSeconds: 60,
      });
      setProviderTested(result.success);
      setStatus(result.success ? `Provider connection succeeded with HTTP ${result.statusCode}.` : `Provider test failed with HTTP ${result.statusCode}.`);
    } catch (error) {
      setProviderTested(false);
      setStatus(handleClientError(error, router, 'Provider test failed.'));
    } finally {
      setTestingProvider(false);
    }
  }

  async function handleTelegramApiTest() {
    setTestingTelegramApi(true);
    setStatus('Testing Telegram API reachability...');
    try {
      const result = await testSetupTelegramApi({
        telegramApiId: Number(form.telegramApiId),
        telegramApiHash: form.telegramApiHash,
      });
      setTelegramApiTested(result.success);
      setStatus(result.message);
    } catch (error) {
      setTelegramApiTested(false);
      setStatus(handleClientError(error, router, 'Telegram API test failed.'));
    } finally {
      setTestingTelegramApi(false);
    }
  }

  async function handleTelegramBotTest() {
    setTestingTelegramBot(true);
    setStatus('Testing Telegram bot credentials...');
    try {
      const result = await testSetupTelegramBot({
        telegramBotToken: form.telegramBotToken,
        ownerTelegramChatId: form.ownerTelegramChatId,
      });
      setTelegramBotTested(result.success);
      if (result.username && !form.telegramBotUsername.trim()) {
        updateForm('telegramBotUsername', result.username);
      }
      setStatus(result.message);
    } catch (error) {
      setTelegramBotTested(false);
      setStatus(handleClientError(error, router, 'Telegram bot test failed.'));
    } finally {
      setTestingTelegramBot(false);
    }
  }

  async function handleOtpSendTest() {
    setSendingOtp(true);
    setToast(null);
    setStatus('Sending a Telegram OTP test...');
    try {
      await sendSetupOtpTest({
        telegramBotToken: form.telegramBotToken,
        ownerTelegramChatId: form.ownerTelegramChatId,
      });
      setOtpVerified(false);
      setStatus('Bot test message and OTP test code sent.');
    } catch (error) {
      const message = handleClientError(error, router, 'OTP test failed.');
      setStatus(message);
      if (message.toLowerCase().includes('start the bot')) {
        setToast({
          message: 'Start the bot from your Telegram account first, then try the OTP test again.',
          tone: 'error',
        });
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleOtpVerify() {
    setVerifyingOtp(true);
    setToast(null);
    setStatus('Verifying the Telegram OTP test...');
    try {
      await verifySetupOtpTest({
        ownerTelegramChatId: form.ownerTelegramChatId,
        code: form.otpCode,
      });
      setOtpVerified(true);
      setStatus('Telegram OTP test verified.');
      setToast({
        message: 'Telegram OTP delivery and verification are working.',
        tone: 'success',
      });
    } catch (error) {
      setOtpVerified(false);
      setStatus(handleClientError(error, router, 'OTP verification failed.'));
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    if (!validation.currentStepValid) {
      setStatus('Finish the required fields and tests in this step before continuing.');
      return;
    }

    if (!isLastStep) {
      const nextStepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setStepIndex(nextStepIndex);
      setStatus(`Step ${nextStepIndex + 1} of ${steps.length}: ${steps[nextStepIndex]?.title}.`);
      return;
    }

    setStatus('Saving setup...');

    try {
      await completeSetup({
        appName: form.appName.trim(),
        timezone: normalizeTimezoneInput(form.timezone),
        authMode: form.authMode,
        password: form.authMode === 'password' ? form.password : undefined,
        telegramApiId: Number(form.telegramApiId),
        telegramApiHash: form.telegramApiHash,
        telegramBotToken: form.telegramBotToken,
        ownerTelegramChatId: form.ownerTelegramChatId,
        telegramBotUsername: form.telegramBotUsername,
        aiProviders: [
          {
            providerType: form.providerType,
            baseUrl: providerRules.showBaseUrl ? form.providerBaseUrl : providerRules.baseUrl,
            apiKey: providerRules.showApiKey ? form.providerApiKey : undefined,
            timeoutSeconds: 60,
            maxTokens: 2048,
            temperature: 0.4,
          },
        ],
      });
      setStatus('Setup completed. Redirecting...');
      router.push(form.authMode === 'none' ? '/dashboard' : '/');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Setup failed.'));
    }
  }

  function goToPreviousStep() {
    const previousStepIndex = Math.max(stepIndex - 1, 0);
    setStepIndex(previousStepIndex);
    setStatus(`Step ${previousStepIndex + 1} of ${steps.length}: ${steps[previousStepIndex]?.title}.`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <SectionHeading
        eyebrow="First launch"
        title="Setup wizard"
        description="This wizard only appears on a fresh first-start setup. After completion, the app goes straight to the main home flow."
      />

      <div className="mt-6">
        <InlineToast message={toast?.message ?? null} tone={toast?.tone} />
      </div>

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
                  onClick={() => {
                    if (index <= stepIndex || validation.stepValidities.slice(0, index).every(Boolean)) {
                      setStepIndex(index);
                    }
                  }}
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
          <FormSection title={`Step ${stepIndex + 1}: ${currentStep.title}`} description={currentStep.description}>
            {stepIndex === 0 ? (
              <div className="grid gap-4">
                <FormField label="Application name" error={validation.errors.appName} helper="Shown in the UI and stored in global settings.">
                  <Input value={form.appName} onChange={(event) => updateForm('appName', event.target.value)} placeholder="DraftMind" />
                </FormField>
                <FormField
                  label="Timezone"
                  error={validation.errors.timezone}
                  helper="Search all supported IANA timezones, or type a numeric value such as UTC+01:00 or UTC-06:30."
                >
                  <TimezoneCombobox value={form.timezone} onChange={(value) => updateForm('timezone', value)} />
                </FormField>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Telegram API ID" error={validation.errors.telegramApiId} helper="API ID for the Telegram account integration.">
                    <div className="flex gap-2">
                      <Input type="number" value={form.telegramApiId} onChange={(event) => updateForm('telegramApiId', event.target.value)} placeholder="1234567" inputMode="numeric" />
                      <Button type="button" variant="secondary" onClick={() => void handleTelegramApiTest()} disabled={testingTelegramApi}>
                        {testingTelegramApi ? 'Testing...' : 'Test'}
                      </Button>
                      {telegramApiTested ? <CheckCircle2 className="mt-3 h-5 w-5 shrink-0 text-emerald-600" /> : null}
                    </div>
                  </FormField>
                  <FormField label="Telegram API hash" error={validation.errors.telegramApiHash} helper="Stored encrypted at rest.">
                    <div className="relative">
                      <Input
                        type={showApiHash ? 'text' : 'password'}
                        value={form.telegramApiHash}
                        onChange={(event) => updateForm('telegramApiHash', event.target.value)}
                        placeholder="Telegram API hash"
                        className="pr-12"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowApiHash((current) => !current)}>
                        {showApiHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>
                </div>

                <div className="border-t border-border/70 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Owner Telegram chat ID" error={validation.errors.ownerTelegramChatId} helper="Used for owner-only approvals, notifications, and OTPs.">
                      <div className="flex gap-2">
                        <Input value={form.ownerTelegramChatId} onChange={(event) => updateForm('ownerTelegramChatId', event.target.value)} placeholder="123456789" />
                        <Link href="https://t.me/userinfobot" target="_blank" className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80">
                          <CircleHelp className="mr-2 h-4 w-4" />
                          Find
                        </Link>
                      </div>
                    </FormField>
                    <FormField label="Telegram bot username" error={validation.errors.telegramBotUsername} helper="Helps confirm which bot the owner should start.">
                      <Input value={form.telegramBotUsername} onChange={(event) => updateForm('telegramBotUsername', event.target.value)} placeholder="draftmind_bot" />
                    </FormField>
                    <FormField label="Telegram bot token" error={validation.errors.telegramBotToken} helper="Used for approvals, OTP, and notifications." className="md:col-span-2">
                      <div className="relative">
                        <Input
                          value={form.telegramBotToken}
                          onChange={(event) => updateForm('telegramBotToken', event.target.value)}
                          placeholder="Telegram bot token"
                          type={showBotToken ? 'text' : 'password'}
                          className="pr-12"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowBotToken((current) => !current)}>
                          {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormField>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link href="https://t.me/BotFather" target="_blank" className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80">
                      <Bot className="mr-2 h-4 w-4" />
                      Open BotFather
                    </Link>
                    <Button type="button" variant="secondary" onClick={() => void handleTelegramBotTest()} disabled={testingTelegramBot}>
                      {testingTelegramBot ? 'Testing...' : 'Test bot'}
                    </Button>
                    {telegramBotTested ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Provider" helper="Choose the provider type that the backend should use.">
                  <select
                    value={form.providerType}
                    onChange={(event) => updateProviderType(event.target.value)}
                    className="flex h-11 w-full rounded-2xl border border-input bg-card px-4 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                {providerRules.showBaseUrl ? (
                  <FormField label="Base URL" error={validation.errors.providerBaseUrl} helper="The default value matches the usual local or compatible server port.">
                    <Input
                      type="url"
                      value={form.providerBaseUrl}
                      onChange={(event) => {
                        updateForm('providerBaseUrl', event.target.value);
                        setProviderTested(false);
                      }}
                    />
                  </FormField>
                ) : (
                  <FormField label="Base URL" helper="The app uses the provider’s official default endpoint automatically.">
                    <Input value={providerRules.baseUrl} disabled />
                  </FormField>
                )}
                {providerRules.showApiKey ? (
                  <FormField label="Provider API key" error={validation.errors.providerApiKey} helper="Stored encrypted and not returned in plaintext after setup." className="md:col-span-2">
                    <div className="relative">
                      <Input
                        value={form.providerApiKey}
                        onChange={(event) => {
                          updateForm('providerApiKey', event.target.value);
                          setProviderTested(false);
                        }}
                        placeholder="Provider API key"
                        type={showProviderApiKey ? 'text' : 'password'}
                        className="pr-12"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowProviderApiKey((current) => !current)}>
                        {showProviderApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>
                ) : null}
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/50 px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    {providerTested ? 'Connection verified.' : 'Test the provider before continuing.'}
                  </p>
                  <Button type="button" variant="secondary" onClick={() => void handleProviderTest()} disabled={testingProvider}>
                    {testingProvider ? 'Testing...' : 'Test connection'}
                  </Button>
                </div>
              </div>
            ) : null}

            {stepIndex === 3 ? (
              <div className="space-y-4">
                <FormField label="Authentication mode" helper="This final step decides how owner access works after setup.">
                  <SegmentedControl value={form.authMode} items={authOptions} onChange={(value) => updateForm('authMode', value)} />
                </FormField>
                {form.authMode === 'password' ? (
                  <FormField label="Owner password" error={validation.errors.password} helper="Use the eye icon to confirm the password before finishing.">
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => updateForm('password', event.target.value)}
                        placeholder="Set the owner password"
                        className="pr-12"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((current) => !current)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>
                ) : null}
                {form.authMode === 'telegram-otp' ? (
                  <div className="space-y-4 rounded-3xl border border-border/70 bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      Start the bot with the same Telegram account whose chat ID you entered earlier, then send and verify an OTP test.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[220px] flex-1">
                        <Input value={form.otpCode} onChange={(event) => updateForm('otpCode', event.target.value)} placeholder="OTP test code" />
                      </div>
                      <Button type="button" variant="secondary" onClick={() => void handleOtpSendTest()} disabled={sendingOtp}>
                        <MessageSquareMore className="mr-2 h-4 w-4" />
                        {sendingOtp ? 'Sending...' : 'Send OTP test'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => void handleOtpVerify()} disabled={verifyingOtp}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {verifyingOtp ? 'Verifying...' : 'Verify'}
                      </Button>
                    </div>
                    {otpVerified ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        OTP verification test passed.
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {form.authMode === 'none' ? (
                  <div className="rounded-3xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                    No browser login will be required after setup. You can still change this later from the management panel.
                  </div>
                ) : null}
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
              <Button type="submit" disabled={!validation.currentStepValid}>
                {isLastStep ? 'Complete setup' : 'Continue'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
