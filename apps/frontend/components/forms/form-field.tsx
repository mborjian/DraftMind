import { cn } from '@/lib/utils';

export function FormField({
  label,
  helper,
  error,
  invalid,
  children,
  className,
}: {
  label: string;
  helper?: string;
  error?: string;
  invalid?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('grid gap-2', invalid ? 'rounded-[1.25rem] ring-2 ring-destructive/70 ring-offset-4 ring-offset-background' : null, className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {helper ? <span className="text-xs leading-6 text-muted-foreground">{helper}</span> : null}
      {error ? <span className="text-xs leading-6 text-destructive">{error}</span> : null}
    </label>
  );
}
