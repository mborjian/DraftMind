import { redirect } from 'next/navigation';
import { requireSetupState, serverApiRequest } from '@/lib/server-api';

export default async function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const setup = await requireSetupState();
  if (setup.initialized) {
    try {
      await serverApiRequest('/auth/session');
      redirect('/dashboard');
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        redirect('/login');
      }
      throw error;
    }
  }

  return children;
}
