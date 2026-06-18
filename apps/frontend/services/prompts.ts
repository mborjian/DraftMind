import { apiRequest } from '@/lib/api-client';

export async function listSystemPrompts() {
  return apiRequest('/system-prompts');
}

export async function getSystemPrompt(id: number) {
  return apiRequest(`/system-prompts/${id}`);
}

export async function updateSystemPrompt(id: number, payload: Record<string, unknown>) {
  return apiRequest(`/system-prompts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
