import { apiRequest } from '@/lib/api-client';
import type { ExecutionDetails, WorkflowExecutionSummary } from '@/types/api';

export async function listExecutions() {
  return apiRequest<WorkflowExecutionSummary[]>('/executions');
}

export async function getExecution(id: number) {
  return apiRequest<ExecutionDetails>(`/executions/${id}`);
}

export async function cancelExecution(id: number) {
  return apiRequest<ExecutionDetails>(`/executions/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
