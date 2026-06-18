import { cn } from '@/lib/utils';

export function FormField({
  label,
  helper,
  error,
  children,
  className,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('grid gap-2', className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {helper ? <span className="text-xs leading-6 text-muted-foreground">{helper}</span> : null}
      {error ? <span className="text-xs leading-6 text-destructive">{error}</span> : null}
    </label>
  );
}
