'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, RefreshCcw, Save, Send } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { FormSection } from '@/components/forms/form-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { handleClientError } from '@/lib/handle-client-error';
import type { Draft } from '@/types/api';
import { publishDraft, regenerateDraft, saveDraft, scheduleDraft, updateDraft } from '@/services/drafts';

export function DraftManager({ initialDrafts }: { initialDrafts: Draft[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [status, setStatus] = useState('Edit, regenerate, save, schedule, or publish the latest draft for each approved topic.');

  async function runDraftAction(id: number, action: 'save' | 'publish' | 'regenerate' | 'schedule', scheduledFor?: string) {
    setStatus(`Running draft ${action}...`);
    try {
      const draft = action === 'save'
        ? await saveDraft(id)
        : action === 'publish'
          ? await publishDraft(id)
          : action === 'schedule' && scheduledFor
            ? await scheduleDraft(id, scheduledFor)
            : await regenerateDraft(id);
      setDrafts(drafts.map((entry) => (entry.id === draft.id ? draft : entry)));
      setStatus(`Draft ${action} completed.`);
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, `Draft ${action} failed.`));
    }
  }

  async function handleUpdate(draft: Draft) {
    setStatus('Saving draft edits...');
    try {
      const next = await updateDraft(draft.id, { title: draft.title, body: draft.body });
      setDrafts(drafts.map((entry) => (entry.id === next.id ? next : entry)));
      setStatus('Draft updated.');
    } catch (error) {
      setStatus(handleClientError(error, router, 'Draft update failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Review" title="Drafts" description="The latest editable draft is retained for each approved topic. Publishing still requires explicit owner action." />
      <div className="space-y-4">
        {drafts.map((draft) => (
          <FormSection key={draft.id} title={draft.title} description={status}>
            <Input value={draft.title} onChange={(event) => setDrafts(drafts.map((entry) => (entry.id === draft.id ? { ...entry, title: event.target.value } : entry)))} />
            <Textarea value={draft.body} onChange={(event) => setDrafts(drafts.map((entry) => (entry.id === draft.id ? { ...entry, body: event.target.value } : entry)))} className="min-h-[220px]" />
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void handleUpdate(draft)}><Save className="mr-2 h-4 w-4" />Save edits</Button>
              <Button variant="ghost" onClick={() => void runDraftAction(draft.id, 'regenerate')}><RefreshCcw className="mr-2 h-4 w-4" />Regenerate</Button>
              <Button variant="ghost" onClick={() => void runDraftAction(draft.id, 'save')}><Save className="mr-2 h-4 w-4" />Save draft</Button>
              <Button variant="ghost" onClick={() => {
                const scheduledFor = window.prompt('Schedule ISO timestamp (UTC)', draft.scheduledFor ?? '');
                if (scheduledFor) {
                  void runDraftAction(draft.id, 'schedule', scheduledFor);
                }
              }}><CalendarClock className="mr-2 h-4 w-4" />Schedule</Button>
              <Button onClick={() => void runDraftAction(draft.id, 'publish')}><Send className="mr-2 h-4 w-4" />Publish now</Button>
            </div>
            <Card className="bg-muted/40 text-sm text-muted-foreground">Status: {draft.status} {draft.publishedAt ? `• Published at ${draft.publishedAt}` : ''}</Card>
          </FormSection>
        ))}
        {drafts.length === 0 ? <Card><p className="text-sm text-muted-foreground">No drafts are available yet.</p></Card> : null}
      </div>
    </div>
  );
}
