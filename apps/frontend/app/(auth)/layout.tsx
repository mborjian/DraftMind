import { redirect } from 'next/navigation';
import { requireSetupState, serverApiRequest } from '@/lib/server-api';

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const setup = await requireSetupState();
  if (!setup.initialized) {
    redirect('/setup');
  }

  if (setup.authMode === 'none') {
    redirect('/dashboard');
  }

  try {
    await serverApiRequest('/auth/session');
    redirect('/dashboard');
  } catch (error) {
    if (error instanceof Error && error.message !== 'UNAUTHORIZED') {
      throw error;
    }
  }

  return children;
}
