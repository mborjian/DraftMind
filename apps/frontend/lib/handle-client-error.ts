import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function handleClientError(error: unknown, router: AppRouterInstance, fallbackMessage: string): string {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    router.push('/login');
    return 'Your session expired. Please log in again.';
  }

  return error instanceof Error ? error.message : fallbackMessage;
}
