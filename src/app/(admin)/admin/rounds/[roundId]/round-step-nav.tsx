import Link from "next/link";
import { ROUND_STEPS } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

export function RoundStepNav({
  roundId,
  roundName,
  current,
}: {
  roundId: string;
  roundName: string;
  current: (typeof ROUND_STEPS)[number]["slug"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-4">
      <p className="mr-2 text-sm font-medium text-muted-foreground">
        {roundName}
      </p>
      {ROUND_STEPS.map((step, index) => {
        const href = `/admin/rounds/${roundId}/${step.slug}`;
        const active = step.slug === current;
        return (
          <Link
            key={step.slug}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 border px-3 py-1.5 text-sm",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="tabular-nums opacity-70">{index + 1}</span>
            {step.title}
          </Link>
        );
      })}
    </div>
  );
}
