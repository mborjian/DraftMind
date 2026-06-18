import { apiRequest } from '@/lib/api-client';
import type { Workflow, WorkflowChat } from '@/types/api';

export async function listWorkflows() {
  return apiRequest<Workflow[]>('/workflows');
}

export async function getWorkflow(id: number) {
  return apiRequest<Workflow>(`/workflows/${id}`);
}

export async function createWorkflow(payload: Record<string, unknown>) {
  return apiRequest<Workflow>('/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWorkflow(id: number, payload: Record<string, unknown>) {
  return apiRequest<Workflow>(`/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkflow(id: number) {
  return apiRequest<{ id: number }>(`/workflows/${id}`, {
    method: 'DELETE',
  });
}

export async function runWorkflow(id: number) {
  return apiRequest<{ id: number }>(`/workflows/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function enableWorkflow(id: number) {
  return apiRequest<Workflow>(`/workflows/${id}/enable`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function disableWorkflow(id: number) {
  return apiRequest<Workflow>(`/workflows/${id}/disable`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function addWorkflowSource(id: number, payload: Omit<WorkflowChat, 'id'>) {
  return apiRequest<Workflow>(`/workflows/${id}/sources`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeWorkflowSource(id: number, sourceId: number) {
  return apiRequest<Workflow>(`/workflows/${id}/sources/${sourceId}`, {
    method: 'DELETE',
  });
}

export async function addWorkflowDestination(id: number, payload: Omit<WorkflowChat, 'id'>) {
  return apiRequest<Workflow>(`/workflows/${id}/destinations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeWorkflowDestination(id: number, destinationId: number) {
  return apiRequest<Workflow>(`/workflows/${id}/destinations/${destinationId}`, {
    method: 'DELETE',
  });
}
