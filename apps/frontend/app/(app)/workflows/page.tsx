import { serverApiRequest } from '@/lib/server-api';
import type { AiPreferencesProfile, AiProvider, Workflow } from '@/types/api';
import { WorkflowManager } from '@/components/workflow/workflow-manager';

export default async function WorkflowsPage() {
  const [workflows, providers, preferences] = await Promise.all([
    serverApiRequest<Workflow[]>('/workflows').catch(() => []),
    serverApiRequest<AiProvider[]>('/ai/providers').catch(() => []),
    serverApiRequest<AiPreferencesProfile[]>('/ai/preferences').catch(() => []),
  ]);

  return <WorkflowManager initialWorkflows={workflows} providers={providers} preferences={preferences} />;
}
