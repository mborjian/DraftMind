import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiBaseUrl } from '@/lib/api-client';

const sessionCookieName =
  process.env.SESSION_COOKIE_NAME ??
  process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ??
  'draftmind_session';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

export async function serverApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message ?? 'Request failed.');
  }

  return payload.data as T;
}

export async function requireSetupState(): Promise<{ initialized: boolean; authMode: string }> {
  return serverApiRequest<{ initialized: boolean; authMode: string }>('/setup/status')
    .catch(() => ({ initialized: false, authMode: 'password' }));
}

export async function requireSessionOrRedirect(): Promise<void> {
  try {
    await serverApiRequest('/auth/session');
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      redirect('/login');
    }
    throw error;
  }
}
