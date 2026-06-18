import { serverApiRequest } from '@/lib/server-api';
import type { WorkflowExecutionSummary } from '@/types/api';
import { ExecutionManager } from '@/components/executions/execution-manager';

export default async function ExecutionsPage() {
  const executions = await serverApiRequest<WorkflowExecutionSummary[]>('/executions').catch(() => []);
  return <ExecutionManager initialExecutions={executions} />;
}
