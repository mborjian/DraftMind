'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { normalizeTimezoneInput, timezoneOptions } from '@/lib/timezones';

export function TimezoneCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const normalizedValue = normalizeTimezoneInput(value);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return timezoneOptions.slice(0, 120);
    }

    return timezoneOptions
      .filter((timezone) => timezone.toLowerCase().includes(normalizedQuery))
      .slice(0, 120);
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            onChange(normalizeTimezoneInput(next));
          }}
          onBlur={() => setQuery(normalizedValue)}
          className="pl-10"
          placeholder="Search IANA timezone or type UTC+01:00"
        />
      </div>
      <div className="max-h-60 overflow-auto rounded-2xl border border-border/70 bg-card/90">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No matching timezone. You can still type a numeric UTC offset.</p>
        ) : (
          filtered.map((timezone) => {
            const active = timezone === normalizedValue;
            return (
              <button
                key={timezone}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(timezone);
                  onChange(timezone);
                }}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-accent/50',
                  active ? 'bg-primary/10 text-foreground' : 'text-foreground',
                )}
              >
                <span>{timezone}</span>
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
