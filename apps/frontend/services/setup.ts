import { apiRequest } from '@/lib/api-client';
import type { SetupStatus } from '@/types/api';

export async function getSetupStatus() {
  return apiRequest<SetupStatus>('/setup/status');
}

export async function completeSetup(payload: Record<string, unknown>) {
  return apiRequest('/setup/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function testSetupProvider(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; statusCode: number; models: string[] }>('/setup/test-provider', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
