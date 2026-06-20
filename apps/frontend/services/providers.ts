import { apiRequest } from '@/lib/api-client';
import type { AiProvider } from '@/types/api';

export async function listProviders() {
  return apiRequest<AiProvider[]>('/ai/providers');
}

export async function createProvider(payload: Record<string, unknown>) {
  return apiRequest<AiProvider>('/ai/providers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProvider(id: number, payload: Record<string, unknown>) {
  return apiRequest<AiProvider>(`/ai/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteProvider(id: number) {
  return apiRequest<AiProvider>(`/ai/providers/${id}`, {
    method: 'DELETE',
  });
}

export async function testProvider(id: number) {
  return apiRequest<{ success: boolean; statusCode: number; models: string[]; provider: AiProvider }>(`/ai/providers/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listProviderModels(id: number) {
  return apiRequest<string[]>(`/ai/providers/${id}/models`);
}
