import { apiRequest } from '@/lib/api-client';
import type { AiPreferencesProfile } from '@/types/api';

export async function listAiPreferences() {
  return apiRequest<AiPreferencesProfile[]>('/ai/preferences');
}

export async function getAiPreferences(id: number) {
  return apiRequest<AiPreferencesProfile>(`/ai/preferences/${id}`);
}

export async function createAiPreferences(payload: Record<string, unknown>) {
  return apiRequest<AiPreferencesProfile>('/ai/preferences', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAiPreferences(id: number, payload: Record<string, unknown>) {
  return apiRequest<AiPreferencesProfile>(`/ai/preferences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
