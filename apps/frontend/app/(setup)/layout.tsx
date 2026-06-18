import { redirect } from 'next/navigation';
import { requireSetupState } from '@/lib/server-api';

export default async function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const setup = await requireSetupState();
  if (setup.initialized) {
    redirect('/login');
  }

  return children;
}
