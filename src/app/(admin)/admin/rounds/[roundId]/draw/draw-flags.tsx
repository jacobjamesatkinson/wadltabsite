import { Badge } from "@/components/ui/badge";
import type { DebateFlag } from "@/db/schema";
import { cn } from "@/lib/utils";

const FLAG_META: Record<DebateFlag, { label: string; className: string }> = {
  pullup: { label: "Pull-up", className: "border-sky-300 bg-sky-50 text-sky-900" },
  rematch: { label: "Rematch", className: "border-amber-300 bg-amber-50 text-amber-900" },
  same_institution: { label: "Same school", className: "border-amber-300 bg-amber-50 text-amber-900" },
  one_up_one_down: { label: "1u1d", className: "border-violet-300 bg-violet-50 text-violet-900" },
  manual: { label: "Edited", className: "border-border bg-muted text-foreground" },
  bubble: { label: "Intermediate", className: "border-sky-300 bg-sky-50 text-sky-900" },
};

export function DrawFlags({ flags, className }: { flags: DebateFlag[]; className?: string }) {
  if (flags.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {flags.map((f) => {
        const meta = FLAG_META[f];
        if (!meta) return null;
        return (
          <Badge key={f} variant="outline" className={meta.className}>
            {meta.label}
          </Badge>
        );
      })}
    </span>
  );
}
