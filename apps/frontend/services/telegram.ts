import { apiRequest } from '@/lib/api-client';
import type { TelegramStatus } from '@/types/api';

export async function getTelegramStatus() {
  return apiRequest<TelegramStatus>('/telegram');
}

export async function updateTelegram(payload: Record<string, unknown>) {
  return apiRequest<TelegramStatus>('/telegram', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function testTelegramApi() {
  return apiRequest<{ success: boolean; message: string }>('/telegram/test-api', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function testTelegramBot() {
  return apiRequest<{ success: boolean; message: string }>('/telegram/test-bot', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
