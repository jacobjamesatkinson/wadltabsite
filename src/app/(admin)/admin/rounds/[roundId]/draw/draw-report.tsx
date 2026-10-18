import Link from "next/link";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import type { DrawIssue, DrawReport } from "@/lib/draw";
import { cn } from "@/lib/utils";

const SEVERITY: Record<
  DrawIssue["severity"],
  { label: string; icon: typeof XCircle; className: string }
> = {
  fatal: {
    label: "Must fix",
    icon: XCircle,
    className: "border-destructive/40 bg-destructive/5 text-destructive",
  },
  warning: {
    label: "Warnings",
    icon: AlertTriangle,
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  info: {
    label: "Notes",
    icon: Info,
    className: "border-border bg-muted/40 text-foreground",
  },
};

export function DrawReportView({
  report,
  compact = false,
}: {
  report: DrawReport;
  compact?: boolean;
}) {
  const groups = (["fatal", "warning", "info"] as const)
    .map((s) => ({ severity: s, issues: report.issues.filter((i) => i.severity === s) }))
    .filter((g) => g.issues.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No problems detected. Every team can be paired within its venue, timeslot and division.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(({ severity, issues }) => {
        const meta = SEVERITY[severity];
        const Icon = meta.icon;
        return (
          <div key={severity} className={cn("border", meta.className)}>
            <div className="flex items-center gap-2 border-b border-current/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
              <Icon className="size-3.5" />
              {meta.label}
              <span className="ml-auto tabular-nums opacity-70">{issues.length}</span>
            </div>
            <ul className={cn("divide-y divide-current/10", compact && "max-h-64 overflow-y-auto")}>
              {issues.map((issue, i) => (
                <li key={`${issue.code}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <span>{issue.message}</span>
                  {issue.fixHref ? (
                    <Link href={issue.fixHref} className="shrink-0 text-xs font-medium underline underline-offset-2">
                      Fix
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function DrawStatsStrip({ report }: { report: DrawReport }) {
  const s = report.stats;
  const items = [
    { label: "Teams", value: s.teams },
    { label: "Groups", value: s.groups },
    { label: "Debates", value: s.debates },
    { label: "Byes", value: s.byes },
    { label: "Pull-ups", value: s.pullups },
    { label: "Rematches", value: s.rematches },
    { label: "Same school", value: s.sameInstitution },
  ];
  return (
    <div className="grid grid-cols-3 gap-px border bg-border sm:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="bg-background px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="text-lg font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
