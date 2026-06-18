import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}
