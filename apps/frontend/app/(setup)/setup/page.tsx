'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, CircleHelp, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupButton } from '@/components/ui/input-group';
import { Select } from '@/components/ui/select';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { TimezoneCombobox } from '@/components/forms/timezone-combobox';
import { InlineToast } from '@/components/ui/toast';
import { handleClientError } from '@/lib/handle-client-error';
import { isValidTimezone, normalizeTimezoneInput } from '@/lib/timezones';
import { completeSetup, testSetupProvider, testSetupTelegramBot } from '@/services/setup';

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
] as const;

const providerOptions = [
  { value: 'gemini', label: 'Gemini API key' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'lm-studio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
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
  const [showApiHash, setShowApiHash] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showProviderApiKey, setShowProviderApiKey] = useState(false);
  const [providerTested, setProviderTested] = useState(false);
  const [telegramBotTested, setTelegramBotTested] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [testingTelegramBot, setTestingTelegramBot] = useState(false);
  const [attemptedStepIndexes, setAttemptedStepIndexes] = useState<number[]>([]);
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
  });

  const currentStep = steps[stepIndex] ?? steps[0];
  const isLastStep = stepIndex === steps.length - 1;
  const providerRules = getProviderDefaults(form.providerType);
  const showStepValidation = attemptedStepIndexes.includes(stepIndex);

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

    const stepValidities = [
      !errors.appName && !errors.timezone,
      !errors.telegramApiId && !errors.telegramApiHash && !errors.ownerTelegramChatId && !errors.telegramBotUsername && !errors.telegramBotToken,
      !errors.providerBaseUrl && !errors.providerApiKey,
    ];

    return {
      errors,
      stepValidities,
      currentStepValid: stepValidities[stepIndex] ?? false,
    };
  }, [form, providerRules.showApiKey, providerRules.showBaseUrl, stepIndex]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    if (key === 'telegramBotToken' || key === 'ownerTelegramChatId' || key === 'telegramBotUsername') {
      setTelegramBotTested(false);
    }

    if (key === 'providerApiKey' || key === 'providerBaseUrl') {
      setProviderTested(false);
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

  function revealCurrentStepValidation() {
    setAttemptedStepIndexes((current) => (current.includes(stepIndex) ? current : [...current, stepIndex]));
  }

  function isFieldInvalid(name: keyof typeof validation.errors) {
    return showStepValidation && Boolean(validation.errors[name]);
  }

  async function handleProviderTest() {
    setTestingProvider(true);
    setToast(null);
    setStatus('Testing the AI provider connection...');
    try {
      const result = await testSetupProvider({
        providerType: form.providerType,
        baseUrl: providerRules.showBaseUrl ? form.providerBaseUrl : providerRules.baseUrl,
        apiKey: providerRules.showApiKey ? form.providerApiKey : undefined,
        timeoutSeconds: 60,
      });
      setProviderTested(result.success);
      const message = result.success
        ? `Provider connection succeeded with HTTP ${result.statusCode}.`
        : result.error
          ? `Provider test failed: ${result.error}`
          : `Provider test failed with HTTP ${result.statusCode}.`;
      setStatus(message);
      setToast({ message, tone: result.success ? 'success' : 'error' });
    } catch (error) {
      setProviderTested(false);
      const message = handleClientError(error, router, 'Provider test failed.');
      setStatus(message);
      setToast({ message, tone: 'error' });
    } finally {
      setTestingProvider(false);
    }
  }

  async function handleTelegramBotTest() {
    setTestingTelegramBot(true);
    setToast(null);
    setStatus('Sending a Telegram bot test message...');
    try {
      const result = await testSetupTelegramBot({
        telegramBotToken: form.telegramBotToken,
        telegramBotUsername: form.telegramBotUsername,
        ownerTelegramChatId: form.ownerTelegramChatId,
      });
      setTelegramBotTested(result.success);
      if (result.username && !form.telegramBotUsername.trim()) {
        updateForm('telegramBotUsername', result.username);
      }
      setStatus(result.message);
      setToast({
        message: result.message,
        tone: result.success ? 'success' : 'info',
      });
    } catch (error) {
      setTelegramBotTested(false);
      const message = handleClientError(error, router, 'Telegram bot test failed.');
      setStatus(message);
      setToast({ message, tone: 'error' });
    } finally {
      setTestingTelegramBot(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    if (!validation.currentStepValid) {
      revealCurrentStepValidation();
      setStatus('Finish the required fields in this step before continuing.');
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
      router.push('/dashboard');
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
      <SectionHeading title="Setup wizard" />

      <div className="mt-6">
        <InlineToast message={toast?.message ?? null} tone={toast?.tone} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const state =
                index === stepIndex
                  ? 'border-primary bg-primary/10 text-foreground'
                  : index < stepIndex
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : 'border-border/70 bg-background/60 text-muted-foreground';
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
                <FormField label="Application name" invalid={isFieldInvalid('appName')} helper="Shown in the UI and stored in global settings.">
                  <Input value={form.appName} onChange={(event) => updateForm('appName', event.target.value)} placeholder="DraftMind" />
                </FormField>
                <FormField
                  label="Timezone"
                  invalid={isFieldInvalid('timezone')}
                  helper="Search all supported IANA timezones, or type a numeric value such as UTC+01:00 or UTC-06:30."
                >
                  <TimezoneCombobox value={form.timezone} onChange={(value) => updateForm('timezone', value)} />
                </FormField>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <FormField label="Telegram API ID" invalid={isFieldInvalid('telegramApiId')} helper="API ID for the Telegram account integration.">
                    <Input type="number" value={form.telegramApiId} onChange={(event) => updateForm('telegramApiId', event.target.value)} placeholder="1234567" inputMode="numeric" />
                  </FormField>
                  <FormField label="Telegram API hash" invalid={isFieldInvalid('telegramApiHash')} helper="Stored encrypted at rest.">
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

                <hr />

                <div className="grid gap-4">
                  <FormField
                    label="Owner Telegram chat ID"
                    invalid={isFieldInvalid('ownerTelegramChatId')}
                    helper="Used for owner-only approvals, notifications, and later auth if you enable it from the management panel."
                  >
                    <InputGroup>
                      <Input value={form.ownerTelegramChatId} onChange={(event) => updateForm('ownerTelegramChatId', event.target.value)} placeholder="123456789" className="pr-24" />
                      <InputGroupButton onClick={() => window.open('https://t.me/userinfobot', '_blank', 'noopener,noreferrer')}>
                        <CircleHelp className="mr-1.5 h-3.5 w-3.5" />
                        Find
                      </InputGroupButton>
                    </InputGroup>
                  </FormField>
                  <FormField label="Telegram bot username" invalid={isFieldInvalid('telegramBotUsername')} helper="Helps confirm which bot the owner should start.">
                    <InputGroup>
                      <Input value={form.telegramBotUsername} onChange={(event) => updateForm('telegramBotUsername', event.target.value)} placeholder="draftmind_bot" className="pr-40" />
                      <InputGroupButton onClick={() => window.open('https://t.me/BotFather', '_blank', 'noopener,noreferrer')}>
                        <Bot className="mr-1.5 h-3.5 w-3.5" />
                        Open BotFather
                      </InputGroupButton>
                    </InputGroup>
                  </FormField>
                  <FormField label="Telegram bot token" invalid={isFieldInvalid('telegramBotToken')} helper="Used for approvals, notifications, and test delivery.">
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

                <div className="space-y-3 rounded-3xl border border-border/70 bg-background/50 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Start the bot from the owner Telegram account first, then click test to send a sample message with the bot.</p>
                  <Button type="button" variant="secondary" onClick={() => void handleTelegramBotTest()} disabled={testingTelegramBot}>
                    {testingTelegramBot ? 'Sending...' : 'Test bot'}
                  </Button>
                  {telegramBotTested ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Test message sent successfully.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="grid gap-4">
                <FormField label="Provider" helper="Choose the provider type that the backend should use.">
                  <Select value={form.providerType} onChange={(event) => updateProviderType(event.target.value)}>
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {providerRules.showBaseUrl ? (
                  <FormField label="Base URL" invalid={isFieldInvalid('providerBaseUrl')} helper="The default value matches the usual local or compatible server port.">
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
                  <FormField label="Base URL" helper="The app uses the provider's official default endpoint automatically.">
                    <Input value={providerRules.baseUrl} disabled />
                  </FormField>
                )}
                {providerRules.showApiKey ? (
                  <FormField label="Provider API key" invalid={isFieldInvalid('providerApiKey')} helper="Stored encrypted and not returned in plaintext after setup.">
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
                <div className="space-y-3 rounded-3xl border border-border/70 bg-background/50 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Use the test button if you want to validate connectivity before continuing.</p>
                  <Button type="button" variant="secondary" onClick={() => void handleProviderTest()} disabled={testingProvider}>
                    {testingProvider ? 'Testing...' : 'Test connection'}
                  </Button>
                  {providerTested ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Provider connection verified.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </FormSection>

          <div className="flex items-center justify-end gap-4 rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
            <Button type="button" variant="secondary" onClick={goToPreviousStep} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button type="submit">{isLastStep ? 'Complete setup' : 'Continue'}</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
