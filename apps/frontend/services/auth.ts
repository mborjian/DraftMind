import { apiRequest } from '@/lib/api-client';
import type { SessionInfo } from '@/types/api';

export async function loginWithPassword(password: string) {
  return apiRequest<{ sessionToken: string; expiresAt: string }>('/auth/login/password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function requestOtp() {
  return apiRequest<null>('/auth/login/request-otp', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function verifyOtp(code: string) {
  return apiRequest<{ sessionToken: string; expiresAt: string }>('/auth/login/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function logout() {
  return apiRequest<null>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getSession() {
  return apiRequest<SessionInfo>('/auth/session');
}
