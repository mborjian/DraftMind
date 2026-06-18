'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, RefreshCcw } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { handleClientError } from '@/lib/handle-client-error';
import type { ExecutionDetails, WorkflowExecutionSummary } from '@/types/api';
import { cancelExecution, getExecution } from '@/services/executions';
import { approveTopic, regenerateTopic, rejectTopic } from '@/services/topics';

export function ExecutionManager({ initialExecutions }: { initialExecutions: WorkflowExecutionSummary[] }) {
  const router = useRouter();
  const [executions] = useState(initialExecutions);
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(initialExecutions[0]?.id ?? null);
  const [details, setDetails] = useState<ExecutionDetails | null>(null);
  const [status, setStatus] = useState('Inspect execution detail, topics, AI usage, and publication history.');

  const selectedSummary = useMemo(() => executions.find((execution) => execution.id === selectedExecutionId) ?? null, [executions, selectedExecutionId]);

  async function loadDetails(id: number) {
    setStatus('Loading execution detail...');
    try {
      const result = await getExecution(id);
      setDetails(result);
      setStatus('Execution detail loaded.');
    } catch (error) {
      setStatus(handleClientError(error, router, 'Execution detail load failed.'));
    }
  }

  async function handleTopicAction(topicId: number, action: 'approve' | 'reject' | 'regenerate') {
    setStatus(`Applying topic ${action}...`);
    try {
      if (action === 'approve') {
        await approveTopic(topicId);
      } else if (action === 'reject') {
        await rejectTopic(topicId);
      } else {
        await regenerateTopic(topicId);
      }

      if (selectedExecutionId) {
        await loadDetails(selectedExecutionId);
      }
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, `Topic ${action} failed.`));
    }
  }

  async function handleCancel(id: number) {
    setStatus('Cancelling execution...');
    try {
      await cancelExecution(id);
      await loadDetails(id);
      router.refresh();
    } catch (error) {
      setStatus(handleClientError(error, router, 'Execution cancellation failed.'));
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="History" title="Executions" description="Track workflow runs, detected topics, token usage, AI logs, and publication outcomes." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {executions.map((execution) => (
            <Card key={execution.id} className={`cursor-pointer space-y-3 ${selectedExecutionId === execution.id ? 'ring-2 ring-ring/40' : ''}`} onClick={() => { setSelectedExecutionId(execution.id); void loadDetails(execution.id); }}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Execution #{execution.id}</h2>
                <span className="text-sm text-muted-foreground">{execution.status}</span>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <p>Topics: {execution.detectedTopicCount}</p>
                <p>Drafts: {execution.generatedDraftCount}</p>
                <p>Tokens: {execution.totalTokens}</p>
                <p>Cost: ${execution.estimatedCost.toFixed(4)}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Execution detail</h2>
                <p className="text-sm text-muted-foreground">{status}</p>
              </div>
              {selectedSummary ? <Button variant="ghost" onClick={() => void handleCancel(selectedSummary.id)}><Ban className="mr-2 h-4 w-4" />Cancel</Button> : null}
            </div>
            {details ? (
              <div className="space-y-4">
                <Card className="bg-muted/40">
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <p>Status: {details.status}</p>
                    <p>Messages: {details.collectedMessageCount}</p>
                    <p>Topics: {details.detectedTopicCount}</p>
                    <p>Drafts: {details.generatedDraftCount}</p>
                  </div>
                </Card>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Topics</h3>
                  {details.topics.map((topic) => (
                    <Card key={topic.id} className="space-y-3">
                      <div>
                        <h4 className="text-lg font-semibold">{topic.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{topic.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => void handleTopicAction(topic.id, 'approve')}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button>
                        <Button variant="ghost" onClick={() => void handleTopicAction(topic.id, 'regenerate')}><RefreshCcw className="mr-2 h-4 w-4" />Regenerate</Button>
                        <Button variant="danger" onClick={() => void handleTopicAction(topic.id, 'reject')}><Ban className="mr-2 h-4 w-4" />Reject</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Select an execution to load topics, AI logs, and publication records.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
