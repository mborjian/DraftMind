import { cn } from '@/lib/utils';

export interface SegmentedItem {
  value: string;
  label: string;
}

export function SegmentedControl({
  value,
  items,
  onChange,
  className,
}: {
  value: string;
  items: readonly SegmentedItem[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-3 rounded-2xl border border-border/80 bg-muted/40 p-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-medium transition',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
