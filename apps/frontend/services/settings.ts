import { apiRequest } from '@/lib/api-client';
import type { AppSettings } from '@/types/api';

export async function getSettings() {
  return apiRequest<AppSettings>('/settings');
}

export async function updateSettings(payload: Partial<AppSettings>) {
  return apiRequest<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
