'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeading } from '@/components/common/section-heading';
import { FormField } from '@/components/forms/form-field';
import { FormSection } from '@/components/forms/form-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { handleClientError } from '@/lib/handle-client-error';
import { updateSystemPrompt } from '@/services/prompts';

interface PromptRecord {
  id: number;
  name: string;
  content: string;
  version: number;
  enabled: boolean;
}

export function PromptManager({ initialPrompts }: { initialPrompts: PromptRecord[] }) {
  const router = useRouter();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [status, setStatus] = useState('System prompts remain developer-controlled and versioned.');

  async function handleSave(prompt: PromptRecord) {
    setStatus('Saving system prompt...');
    try {
      const next = await updateSystemPrompt(prompt.id, { name: prompt.name, content: prompt.content });
      setPrompts(prompts.map((entry) => (entry.id === prompt.id ? (next as PromptRecord) : entry)));
      setStatus('System prompt updated.');
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'System prompt update failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Prompting" title="System prompts" description="Developer prompts remain authoritative over workflow prompts and source content." />
      <div className="space-y-4">
        {prompts.map((prompt, index) => (
          <FormSection key={prompt.id} title={`${prompt.name} (v${prompt.version})`} description={status}>
            <FormField label="Prompt name"><Input value={prompt.name} onChange={(event) => setPrompts(prompts.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} /></FormField>
            <FormField label="Prompt content"><Textarea value={prompt.content} onChange={(event) => setPrompts(prompts.map((entry, entryIndex) => entryIndex === index ? { ...entry, content: event.target.value } : entry))} className="min-h-[280px] font-mono text-xs" /></FormField>
            <div className="flex justify-between gap-3">
              <Card className="bg-muted/40 text-sm text-muted-foreground">Enabled: {prompt.enabled ? 'Yes' : 'No'}</Card>
              <Button onClick={() => void handleSave(prompt)}>Save prompt</Button>
            </div>
          </FormSection>
        ))}
      </div>
    </div>
  );
}
