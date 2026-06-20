import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function InlineToast({
  message,
  tone = 'info',
}: {
  message: string | null;
  tone?: 'info' | 'success' | 'error';
}) {
  if (!message) {
    return null;
  }

  const icon =
    tone === 'success'
      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
      : <AlertCircle className="h-4 w-4 shrink-0" />;

  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
      : tone === 'error'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border/80 bg-card/90 text-foreground';

  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      {icon}
      <span>{message}</span>
    </div>
  );
}
