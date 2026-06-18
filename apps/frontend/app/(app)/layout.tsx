import { redirect } from 'next/navigation';
import { requireSetupState, serverApiRequest } from '@/lib/server-api';
import { AppShell } from '@/components/navigation/app-shell';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const setup = await requireSetupState();
  if (!setup.initialized) {
    redirect('/setup');
  }

  try {
    await serverApiRequest('/auth/session');
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      redirect('/login');
    }
    throw error;
  }

  return <AppShell>{children}</AppShell>;
}
