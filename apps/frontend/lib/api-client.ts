export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
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
