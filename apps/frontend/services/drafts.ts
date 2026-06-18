import { apiRequest } from '@/lib/api-client';
import type { Draft } from '@/types/api';

export async function listDrafts() {
  return apiRequest<Draft[]>('/drafts');
}

export async function getDraft(id: number) {
  return apiRequest<Draft>(`/drafts/${id}`);
}

export async function updateDraft(id: number, payload: Record<string, unknown>) {
  return apiRequest<Draft>(`/drafts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function regenerateDraft(id: number) {
  return apiRequest<Draft>(`/drafts/${id}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function saveDraft(id: number) {
  return apiRequest<Draft>(`/drafts/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function publishDraft(id: number) {
  return apiRequest<Draft>(`/drafts/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function scheduleDraft(id: number, scheduledFor: string) {
  return apiRequest<Draft>(`/drafts/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledFor }),
  });
}
