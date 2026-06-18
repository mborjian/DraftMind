'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { Button } from '@/components/ui/button';
import { logout } from '@/services/auth';
import { handleClientError } from '@/lib/handle-client-error';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
      router.push('/login');
      router.refresh();
    } catch (error) {
      window.alert(handleClientError(error, router, 'Logout failed.'));
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-6">
      <div className="space-y-4">
        <AppSidebar currentPath={pathname} />
        <div className="rounded-[1.75rem] border border-border/70 bg-card/85 p-4 shadow-xl shadow-slate-900/5 backdrop-blur">
          <Button variant="ghost" className="w-full justify-start rounded-2xl" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <main className="rounded-[2rem] border border-border/70 bg-card/45 p-4 shadow-2xl shadow-slate-900/5 backdrop-blur lg:p-8">
        {children}
      </main>
    </div>
  );
}
