import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card className="space-y-3 p-5">
      <Badge>{label}</Badge>
      <div>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {helper ? <p className="mt-2 text-sm text-muted-foreground">{helper}</p> : null}
      </div>
    </Card>
  );
}
