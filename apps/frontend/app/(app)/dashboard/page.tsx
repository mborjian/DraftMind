import { SectionHeading } from '@/components/common/section-heading';
import { StatCard } from '@/components/cards/stat-card';
import { Card } from '@/components/ui/card';
import { serverApiRequest } from '@/lib/server-api';
import type { CostSummary, Draft, HealthStatus, Publication, Workflow, WorkflowExecutionSummary } from '@/types/api';

export default async function DashboardPage() {
  const [health, costs, drafts, executions, workflows, publications] = await Promise.all([
    serverApiRequest<HealthStatus>('/health').catch(() => null),
    serverApiRequest<CostSummary>('/costs').catch(() => null),
    serverApiRequest<Draft[]>('/drafts').catch(() => []),
    serverApiRequest<WorkflowExecutionSummary[]>('/executions').catch(() => []),
    serverApiRequest<Workflow[]>('/workflows').catch(() => []),
    serverApiRequest<Publication[]>('/publications').catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Operations"
        title="Dashboard"
        description="A single-owner operational view over workflows, Telegram connectivity, pending drafts, and AI usage."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workflows" value={String(workflows.length)} helper="Active and archived workflow definitions." />
        <StatCard label="Drafts" value={String(drafts.length)} helper="Current editable drafts awaiting action." />
        <StatCard label="Executions" value={String(executions.length)} helper="Historical runs and in-flight workflow activity." />
        <StatCard label="AI Cost" value={costs ? `$${costs.estimatedSpending.toFixed(2)}` : 'Unavailable'} helper="Estimated provider spending from logged requests." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">System health</h2>
          {health ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-sm text-muted-foreground">Database</p>
                <p className="mt-2 text-2xl font-semibold capitalize">{health.database}</p>
              </div>
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-sm text-muted-foreground">Telegram bot</p>
                <p className="mt-2 text-2xl font-semibold">{health.telegram.telegramBotConfigured ? 'Configured' : 'Missing'}</p>
              </div>
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-sm text-muted-foreground">Scheduler mode</p>
                <p className="mt-2 text-lg font-semibold">{health.scheduler.mode}</p>
              </div>
              <div className="rounded-3xl border border-border/80 p-4">
                <p className="text-sm text-muted-foreground">Active workflows</p>
                <p className="mt-2 text-2xl font-semibold">{health.scheduler.activeWorkflowCount}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Health data is unavailable.</p>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Recent publications</h2>
          <div className="space-y-3">
            {publications.slice(0, 5).map((publication) => (
              <div key={publication.id} className="rounded-3xl border border-border/80 p-4">
                <p className="font-medium">{publication.destinationTitle ?? 'Destination'}</p>
                <p className="mt-1 text-sm text-muted-foreground">Status: {publication.status}</p>
                <p className="text-xs text-muted-foreground">{publication.sentAt ?? 'Pending send time'}</p>
              </div>
            ))}
            {publications.length === 0 ? <p className="text-sm text-muted-foreground">No publication records yet.</p> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
