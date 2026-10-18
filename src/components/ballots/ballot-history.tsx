import type { BallotDebate } from "@/lib/ballots/load";
import { cn } from "@/lib/utils";

/** Version history for a debate's ballots (Tabbycat shows every submission). */
export function BallotHistory({ debate }: { debate: BallotDebate }) {
  if (debate.versions.length === 0) return null;
  const nameFor = (teamId: string | null) =>
    teamId === debate.affirmative?.id
      ? debate.affirmative?.name
      : teamId === debate.negative?.id
        ? debate.negative?.name
        : "Draw";
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Ballot history</h2>
      <ul className="divide-y border text-sm">
        {debate.versions.map((v) => (
          <li key={v.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2", v.discarded && "text-muted-foreground line-through")}>
            <span className="font-medium tabular-nums">v{v.version}</span>
            <span>
              {v.discarded ? "Discarded" : v.status === "accepted" ? "Confirmed" : "Unconfirmed"}
            </span>
            <span className="tabular-nums">
              {v.affTotal ?? "—"}–{v.negTotal ?? "—"}
              {v.winnerTeamId || v.affTotal === v.negTotal ? ` · ${nameFor(v.winnerTeamId)}` : ""}
            </span>
            <span className="ml-auto text-xs">
              {v.enteredBy} · {v.enteredAt}
              {v.confirmedBy ? ` · confirmed by ${v.confirmedBy}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
