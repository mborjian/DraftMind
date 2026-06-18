import Link from 'next/link';
import { Bot, Brain, FilePenLine, Gauge, LayoutDashboard, MessageCircleMore, Settings2, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
  { href: '/drafts', label: 'Drafts', icon: FilePenLine },
  { href: '/executions', label: 'Executions', icon: Gauge },
  { href: '/providers', label: 'AI Providers', icon: Brain },
  { href: '/prompts', label: 'Prompts', icon: MessageCircleMore },
  { href: '/telegram', label: 'Telegram', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings2 },
  { href: '/costs', label: 'Costs', icon: Gauge },
];

export function AppSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="rounded-[2rem] border border-border/70 bg-card/85 p-4 shadow-2xl shadow-slate-900/5 backdrop-blur">
      <div className="mb-6 rounded-3xl bg-primary px-4 py-5 text-primary-foreground">
        <p className="text-xs uppercase tracking-[0.22em] text-primary-foreground/80">DraftMind</p>
        <h2 className="mt-2 text-2xl font-semibold">Owner Console</h2>
        <p className="mt-2 text-sm leading-6 text-primary-foreground/80">
          Telegram-first review and publishing control for a single deployment.
        </p>
      </div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
