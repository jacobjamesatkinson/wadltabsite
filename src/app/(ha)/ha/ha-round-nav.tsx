import Link from "next/link";
import { cn } from "@/lib/utils";

export type HaRoundNavItem = {
  id: string;
  name: string;
  number: number;
};

export function HaRoundNav({
  rounds,
  activeRoundId,
  basePath,
  label = "Rounds",
}: {
  rounds: HaRoundNavItem[];
  activeRoundId: string | null;
  basePath: string;
  label?: string;
}) {
  return (
    <nav className="rounded-lg border bg-card" aria-label={label}>
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ul className="divide-y">
        {rounds.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">No rounds yet</li>
        ) : (
          rounds.map((round) => {
            const active = round.id === activeRoundId;
            return (
              <li key={round.id}>
                <Link
                  href={`${basePath}?round=${round.id}`}
                  className={cn(
                    "block px-3 py-2 text-sm hover:bg-muted/50",
                    active && "bg-muted font-medium text-foreground"
                  )}
                >
                  {round.name}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </nav>
  );
}
