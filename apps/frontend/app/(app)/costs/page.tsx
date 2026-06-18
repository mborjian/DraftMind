import { SectionHeading } from '@/components/common/section-heading';
import { Card } from '@/components/ui/card';
import { serverApiRequest } from '@/lib/server-api';
import type { CostSummary } from '@/types/api';

export default async function CostsPage() {
  const costs = await serverApiRequest<CostSummary>('/costs').catch(() => null);

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Usage" title="Costs" description="Operational AI usage totals with provider and model breakdowns." />
      {costs ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Requests</p>
              <p className="mt-2 text-2xl font-semibold">{costs.totalRequests}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tokens</p>
              <p className="mt-2 text-2xl font-semibold">{costs.totalTokens}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estimated spend</p>
              <p className="mt-2 text-2xl font-semibold">${costs.estimatedSpending.toFixed(2)}</p>
            </div>
          </Card>
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">By provider</h2>
            <div className="space-y-3">
              {costs.byProvider.map((entry) => (
                <div key={entry.providerName} className="flex items-center justify-between rounded-3xl border border-border/80 px-4 py-3 text-sm">
                  <span>{entry.providerName}</span>
                  <span>{entry.requestCount} requests • ${entry.estimatedCost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <Card><p className="text-sm text-muted-foreground">Cost data is unavailable until AI requests have been logged.</p></Card>
      )}
    </div>
  );
}
