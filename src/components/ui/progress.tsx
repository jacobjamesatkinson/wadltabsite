"use client";

import { cn } from "@/lib/utils";

export function Progress({
  value = 0,
  className,
}: {
  value?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden bg-primary/20", className)}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
