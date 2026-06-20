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

export async function testSetupTelegramApi(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; statusCode: number; message: string }>('/setup/test-telegram-api', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function testSetupTelegramBot(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; statusCode: number; username: string | null; message: string }>('/setup/test-telegram-bot', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendSetupOtpTest(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; expiresAt: string }>('/setup/test-otp/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifySetupOtpTest(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean }>('/setup/test-otp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
