import * as React from 'react';
import { cn } from '@/lib/utils';

export function InputGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('relative flex w-full items-center', className)}>{children}</div>;
}

export function InputGroupButton({
  className,
  type = 'button',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'absolute right-2 top-1/2 z-10 inline-flex h-8 items-center justify-center rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
