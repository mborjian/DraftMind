import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSetupState, serverApiRequest } from '@/lib/server-api';

export default async function HomePage() {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
        <section className="space-y-6">
          <p className="inline-flex rounded-full border border-border/70 bg-card/80 px-4 py-1 text-xs uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
            Telegram-first editorial automation
          </p>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
              Human-approved AI workflows for Telegram publishing.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              DraftMind collects source messages, clusters them into topics, routes approvals through a Telegram bot,
              and keeps publishing under explicit owner control.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90">
              Open owner login
            </Link>
            <Link href="/setup" className="rounded-full border border-border bg-card/90 px-6 py-3 text-sm font-medium text-foreground transition hover:bg-accent/70">
              Review setup wizard
            </Link>
          </div>
        </section>
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-2xl shadow-slate-900/5 backdrop-blur">
          <div className="space-y-4">
            <div className="rounded-3xl bg-secondary/70 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workflow sequence</p>
              <ul className="mt-3 space-y-3 text-sm leading-6">
                <li>1. Collect Telegram messages for the scheduled window</li>
                <li>2. Detect topics and send them to the management bot</li>
                <li>3. Approve topics before any draft generation</li>
                <li>4. Edit, regenerate, schedule, or publish drafts</li>
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Security</p>
                <p className="mt-2 text-sm text-foreground">Encrypted secrets, cookie sessions, typed AI preferences.</p>
              </div>
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deployment</p>
                <p className="mt-2 text-sm text-foreground">Single-owner, SQLite-backed, self-hosted Node runtime.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
