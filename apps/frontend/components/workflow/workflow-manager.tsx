'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Power, Trash2 } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { handleClientError } from '@/lib/handle-client-error';
import type { AiPreferencesProfile, AiProvider, Workflow } from '@/types/api';
import {
  createWorkflow,
  deleteWorkflow,
  disableWorkflow,
  enableWorkflow,
  runWorkflow,
  updateWorkflow,
} from '@/services/workflows';

interface WorkflowManagerProps {
  initialWorkflows: Workflow[];
  providers: AiProvider[];
  preferences: AiPreferencesProfile[];
}

const emptyChat = { telegramChatId: '', title: '', username: '', type: 'channel' };
const emptyWorkflow = {
  name: '',
  description: '',
  enabled: true,
  cronExpression: '0 * * * *',
  timezone: 'UTC',
  publishMode: 'scheduled',
  publishIntervalMinutes: 0,
  aiProviderId: '',
  aiPreferencesId: '',
  userPrompt: '',
  sources: [{ ...emptyChat }],
  destinations: [{ ...emptyChat }],
};

export function WorkflowManager({ initialWorkflows, providers, preferences }: WorkflowManagerProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | 'new'>(initialWorkflows[0]?.id ?? 'new');
  const [form, setForm] = useState(emptyWorkflow);
  const [status, setStatus] = useState('Manage workflow schedules, Telegram sources, destinations, and prompts.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows],
  );

  function resetToWorkflow(workflow: Workflow | null) {
    if (!workflow) {
      setForm(emptyWorkflow);
      return;
    }

    setForm({
      name: workflow.name,
      description: workflow.description ?? '',
      enabled: workflow.enabled,
      cronExpression: workflow.cronExpression,
      timezone: workflow.timezone,
      publishMode: workflow.publishMode,
      publishIntervalMinutes: workflow.publishIntervalMinutes,
      aiProviderId: workflow.aiProviderId ? String(workflow.aiProviderId) : '',
      aiPreferencesId: workflow.aiPreferencesId ? String(workflow.aiPreferencesId) : '',
      userPrompt: workflow.userPrompt,
      sources: workflow.sources.length > 0
        ? workflow.sources.map((source) => ({
            telegramChatId: source.telegramChatId,
            title: source.title,
            username: source.username ?? '',
            type: source.type,
          }))
        : [{ ...emptyChat }],
      destinations: workflow.destinations.length > 0
        ? workflow.destinations.map((destination) => ({
            telegramChatId: destination.telegramChatId,
            title: destination.title,
            username: destination.username ?? '',
            type: destination.type,
          }))
        : [{ ...emptyChat }],
    });
  }

  async function handleSave() {
    setIsSubmitting(true);
    setStatus('Saving workflow...');

    const payload = {
      name: form.name,
      description: form.description || null,
      enabled: form.enabled,
      cronExpression: form.cronExpression,
      timezone: form.timezone,
      publishMode: form.publishMode,
      publishIntervalMinutes: Number(form.publishIntervalMinutes),
      aiProviderId: form.aiProviderId ? Number(form.aiProviderId) : null,
      aiPreferencesId: form.aiPreferencesId ? Number(form.aiPreferencesId) : null,
      userPrompt: form.userPrompt,
      sources: form.sources.filter((source) => source.telegramChatId && source.title),
      destinations: form.destinations.filter((destination) => destination.telegramChatId && destination.title),
    };

    try {
      const workflow = selectedWorkflow
        ? await updateWorkflow(selectedWorkflow.id, payload)
        : await createWorkflow(payload);

      const nextWorkflows = selectedWorkflow
        ? workflows.map((entry) => (entry.id === workflow.id ? workflow : entry))
        : [workflow, ...workflows];
      setWorkflows(nextWorkflows);
      setSelectedWorkflowId(workflow.id);
      resetToWorkflow(workflow);
      setStatus('Workflow saved.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Workflow save failed.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(workflow: Workflow) {
    setStatus('Updating workflow status...');
    try {
      const next = workflow.enabled ? await disableWorkflow(workflow.id) : await enableWorkflow(workflow.id);
      setWorkflows(workflows.map((entry) => (entry.id === next.id ? next : entry)));
      if (selectedWorkflowId === next.id) {
        resetToWorkflow(next);
      }
      setStatus(`Workflow ${next.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setStatus(handleClientError(error, router, 'Workflow status update failed.'));
    }
  }

  async function handleRun(workflow: Workflow) {
    setStatus('Starting workflow execution...');
    try {
      await runWorkflow(workflow.id);
      setStatus('Workflow execution started. Topic review will continue through Telegram.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Workflow run failed.'));
    }
  }

  async function handleDelete(workflow: Workflow) {
    if (!window.confirm(`Delete workflow ${workflow.name}?`)) {
      return;
    }

    setStatus('Deleting workflow...');
    try {
      await deleteWorkflow(workflow.id);
      const nextWorkflows = workflows.filter((entry) => entry.id !== workflow.id);
      setWorkflows(nextWorkflows);
      const nextSelected = nextWorkflows[0] ?? null;
      setSelectedWorkflowId(nextSelected?.id ?? 'new');
      resetToWorkflow(nextSelected);
      setStatus('Workflow deleted.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Workflow delete failed.'));
    }
  }

  function updateChat(kind: 'sources' | 'destinations', index: number, key: string, value: string) {
    setForm((current) => ({
      ...current,
      [kind]: current[kind].map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry)),
    }));
  }

  function addChat(kind: 'sources' | 'destinations') {
    setForm((current) => ({
      ...current,
      [kind]: [...current[kind], { ...emptyChat }],
    }));
  }

  function removeChat(kind: 'sources' | 'destinations', index: number) {
    setForm((current) => ({
      ...current,
      [kind]: current[kind].length === 1 ? [{ ...emptyChat }] : current[kind].filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Automation"
        title="Workflows"
        description="Create, edit, enable, and manually run Telegram collection and publication workflows."
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Workflow list</h2>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedWorkflowId('new');
                resetToWorkflow(null);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New workflow
            </Button>
          </div>
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className={`space-y-4 cursor-pointer transition ${selectedWorkflowId === workflow.id ? 'ring-2 ring-ring/40' : ''}`}
                onClick={() => {
                  setSelectedWorkflowId(workflow.id);
                  resetToWorkflow(workflow);
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{workflow.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{workflow.description ?? 'No description provided.'}</p>
                  </div>
                  <Badge>{workflow.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Schedule</dt>
                    <dd className="mt-1 text-sm">{workflow.cronExpression}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next run</dt>
                    <dd className="mt-1 text-sm">{workflow.state?.nextRunAt ?? 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sources</dt>
                    <dd className="mt-1 text-sm">{workflow.sources.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Destinations</dt>
                    <dd className="mt-1 text-sm">{workflow.destinations.length}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void handleRun(workflow); }}>
                    <Play className="mr-2 h-4 w-4" />
                    Run
                  </Button>
                  <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void handleToggle(workflow); }}>
                    <Power className="mr-2 h-4 w-4" />
                    {workflow.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" onClick={(event) => { event.stopPropagation(); void handleDelete(workflow); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
            {workflows.length === 0 ? <Card><p className="text-sm text-muted-foreground">No workflows have been created yet.</p></Card> : null}
          </div>
        </div>

        <div className="space-y-4">
          <FormSection title={selectedWorkflow ? `Edit ${selectedWorkflow.name}` : 'Create workflow'} description={status}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Name">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </FormField>
              <FormField label="Timezone">
                <Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
              </FormField>
              <FormField label="Cron expression">
                <Input value={form.cronExpression} onChange={(event) => setForm({ ...form, cronExpression: event.target.value })} />
              </FormField>
              <FormField label="Publish mode">
                <Select value={form.publishMode} onChange={(event) => setForm({ ...form, publishMode: event.target.value })}>
                  <option value="scheduled">Scheduled</option>
                  <option value="immediate">Immediate</option>
                </Select>
              </FormField>
              <FormField label="Publish interval (minutes)">
                <Input type="number" value={form.publishIntervalMinutes} onChange={(event) => setForm({ ...form, publishIntervalMinutes: Number(event.target.value) })} />
              </FormField>
              <FormField label="AI provider">
                <Select value={form.aiProviderId} onChange={(event) => setForm({ ...form, aiProviderId: event.target.value })}>
                  <option value="">Select provider</option>
                  {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </Select>
              </FormField>
              <FormField label="AI preferences">
                <Select value={form.aiPreferencesId} onChange={(event) => setForm({ ...form, aiPreferencesId: event.target.value })}>
                  <option value="">Select preferences</option>
                  {preferences.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Enabled">
                <Select value={String(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.value === 'true' })}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </FormField>
            <FormField label="Workflow prompt" helper="Developer system prompts remain authoritative. This prompt supplements them.">
              <Textarea value={form.userPrompt} onChange={(event) => setForm({ ...form, userPrompt: event.target.value })} />
            </FormField>

            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection title="Sources" description="Telegram channels and groups to collect from." className="bg-muted/30">
                {form.sources.map((source, index) => (
                  <div key={`source-${index}`} className="grid gap-3 rounded-3xl border border-border/70 p-4">
                    <Input placeholder="Chat ID" value={source.telegramChatId} onChange={(event) => updateChat('sources', index, 'telegramChatId', event.target.value)} />
                    <Input placeholder="Title" value={source.title} onChange={(event) => updateChat('sources', index, 'title', event.target.value)} />
                    <Input placeholder="Username" value={source.username} onChange={(event) => updateChat('sources', index, 'username', event.target.value)} />
                    <Select value={source.type} onChange={(event) => updateChat('sources', index, 'type', event.target.value)}>
                      <option value="channel">Channel</option>
                      <option value="group">Group</option>
                    </Select>
                    <Button variant="ghost" onClick={() => removeChat('sources', index)}>Remove source</Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => addChat('sources')}>Add source</Button>
              </FormSection>
              <FormSection title="Destinations" description="Telegram channels and groups to publish to." className="bg-muted/30">
                {form.destinations.map((destination, index) => (
                  <div key={`destination-${index}`} className="grid gap-3 rounded-3xl border border-border/70 p-4">
                    <Input placeholder="Chat ID" value={destination.telegramChatId} onChange={(event) => updateChat('destinations', index, 'telegramChatId', event.target.value)} />
                    <Input placeholder="Title" value={destination.title} onChange={(event) => updateChat('destinations', index, 'title', event.target.value)} />
                    <Input placeholder="Username" value={destination.username} onChange={(event) => updateChat('destinations', index, 'username', event.target.value)} />
                    <Select value={destination.type} onChange={(event) => updateChat('destinations', index, 'type', event.target.value)}>
                      <option value="channel">Channel</option>
                      <option value="group">Group</option>
                    </Select>
                    <Button variant="ghost" onClick={() => removeChat('destinations', index)}>Remove destination</Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => addChat('destinations')}>Add destination</Button>
              </FormSection>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => resetToWorkflow(selectedWorkflow)}>Reset</Button>
              <Button onClick={() => void handleSave()} disabled={isSubmitting}>{selectedWorkflow ? 'Update workflow' : 'Create workflow'}</Button>
            </div>
          </FormSection>
        </div>
      </div>
    </div>
  );
}
