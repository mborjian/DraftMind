'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Power, TestTube2, Trash2 } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { handleClientError } from '@/lib/handle-client-error';
import type { AiProvider } from '@/types/api';
import { createProvider, deleteProvider, listProviderModels, testProvider, updateProvider } from '@/services/providers';

const emptyProvider = {
  name: '',
  providerType: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'workflow-selected',
  apiKey: '',
  enabled: true,
  timeoutSeconds: 60,
  maxTokens: 2048,
  temperature: 0.4,
};

export function ProviderManager({ initialProviders }: { initialProviders: AiProvider[] }) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [selectedProviderId, setSelectedProviderId] = useState<number | 'new'>(initialProviders[0]?.id ?? 'new');
  const [form, setForm] = useState(emptyProvider);
  const [models, setModels] = useState<string[]>([emptyProvider.model]);
  const [status, setStatus] = useState('Configure provider endpoints and credentials. Models are selected per workflow.');

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? null;

  function loadProvider(provider: AiProvider | null) {
    if (!provider) {
      setForm(emptyProvider);
      return;
    }

    setForm({
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: '',
      enabled: provider.enabled,
      timeoutSeconds: provider.timeoutSeconds,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
    });
    setModels([provider.model]);
  }

  async function handleSave() {
    setStatus('Saving provider...');
    try {
      const payload = {
        ...form,
        timeoutSeconds: Number(form.timeoutSeconds),
        maxTokens: Number(form.maxTokens),
        temperature: Number(form.temperature),
        apiKey: form.apiKey || undefined,
      };

      const provider = selectedProvider
        ? await updateProvider(selectedProvider.id, payload)
        : await createProvider(payload);

      setProviders(selectedProvider ? providers.map((entry) => (entry.id === provider.id ? provider : entry)) : [provider, ...providers]);
      setSelectedProviderId(provider.id);
      loadProvider(provider);
      setStatus('Provider saved.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Provider save failed.'));
    }
  }

  async function handleDelete(provider: AiProvider) {
    if (!window.confirm(`Disable provider ${provider.name}?`)) {
      return;
    }

    setStatus('Disabling provider...');
    try {
      await deleteProvider(provider.id);
      const nextProviders = providers.filter((entry) => entry.id !== provider.id);
      setProviders(nextProviders);
      const next = nextProviders[0] ?? null;
      setSelectedProviderId(next?.id ?? 'new');
      loadProvider(next);
      setStatus('Provider disabled.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Provider disable failed.'));
    }
  }

  async function handleTest(providerId: number) {
    setStatus('Testing provider connectivity...');
    try {
      const result = await testProvider(providerId);
      const nextModels = result.models.length > 0 ? result.models : [form.model];
      setModels(nextModels);
      if (!nextModels.includes(form.model)) {
        setForm((current) => ({ ...current, model: nextModels[0] ?? current.model }));
      }
      setStatus(result.success ? `Provider test succeeded with HTTP ${result.statusCode}. ${nextModels.length} model(s) available.` : `Provider test failed with HTTP ${result.statusCode}.`);
    } catch (error) {
      setStatus(handleClientError(error, router, 'Provider test failed.'));
    }
  }

  async function handleLoadModels() {
    if (!selectedProvider) {
      return;
    }

    setStatus('Loading provider models...');
    try {
      const nextModels = await listProviderModels(selectedProvider.id);
      setModels(nextModels.length > 0 ? nextModels : [form.model]);
      setStatus(nextModels.length > 0 ? `Loaded ${nextModels.length} model(s).` : 'No models were returned by the provider.');
    } catch (error) {
      setStatus(handleClientError(error, router, 'Model load failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="AI" title="Providers" description="Create and validate provider connections without exposing stored API keys." />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Configured providers</h2>
            <Button variant="secondary" onClick={() => { setSelectedProviderId('new'); loadProvider(null); }}>
              <Plus className="mr-2 h-4 w-4" />
              New provider
            </Button>
          </div>
          <div className="space-y-3">
            {providers.map((provider) => (
              <Card key={provider.id} className={`space-y-4 cursor-pointer ${selectedProviderId === provider.id ? 'ring-2 ring-ring/40' : ''}`} onClick={() => { setSelectedProviderId(provider.id); loadProvider(provider); }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{provider.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{provider.providerType}</p>
                  </div>
                  <Badge>{provider.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Model mode: {provider.model}</p>
                  <p>API key: {provider.hasApiKey ? 'Stored securely' : 'Missing'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void handleTest(provider.id); }}><TestTube2 className="mr-2 h-4 w-4" />Test</Button>
                  <Button variant="danger" onClick={(event) => { event.stopPropagation(); void handleDelete(provider); }}><Trash2 className="mr-2 h-4 w-4" />Disable</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <FormSection title={selectedProvider ? `Edit ${selectedProvider.name}` : 'Create provider'} description={status}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
            <FormField label="Provider type"><Select value={form.providerType} onChange={(event) => setForm({ ...form, providerType: event.target.value })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="openai-compatible">OpenAI-compatible</option><option value="lm-studio">LM Studio</option><option value="ollama">Ollama</option></Select></FormField>
            <FormField label="Base URL"><Input type="url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></FormField>
            <FormField label="Model policy" helper="Stored only as a fallback. Workflow records should choose the active model."><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></FormField>
            <FormField label="API key" helper={selectedProvider ? 'Leave blank to keep the currently stored key.' : 'Stored encrypted at rest.'}><Input value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} type="password" /></FormField>
            <FormField label="Enabled"><Select value={String(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.value === 'true' })}><option value="true">Enabled</option><option value="false">Disabled</option></Select></FormField>
            <FormField label="Timeout seconds"><Input type="number" value={form.timeoutSeconds} onChange={(event) => setForm({ ...form, timeoutSeconds: Number(event.target.value) })} /></FormField>
            <FormField label="Maximum tokens"><Input type="number" value={form.maxTokens} onChange={(event) => setForm({ ...form, maxTokens: Number(event.target.value) })} /></FormField>
            <FormField label="Temperature"><Input type="number" step="0.1" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })} /></FormField>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {selectedProvider ? <Button variant="ghost" onClick={() => void handleLoadModels()}>Load models</Button> : null}
            {selectedProvider ? <Button variant="ghost" onClick={() => void handleTest(selectedProvider.id)}><Power className="mr-2 h-4 w-4" />Test connection</Button> : null}
            <Button onClick={() => void handleSave()}>{selectedProvider ? 'Update provider' : 'Create provider'}</Button>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
