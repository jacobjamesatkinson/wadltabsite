import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adjudicatorAssignments, ballots, rounds } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";

export default async function AdjudicatorBallotsPage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  const assignments = profile
    ? await db
        .select()
        .from(adjudicatorAssignments)
        .where(eq(adjudicatorAssignments.adjudicatorId, profile.id))
    : [];
  const debateIds = assignments.map((a) => a.debateId);
  const debateRows =
    debateIds.length > 0
      ? await db.query.debates.findMany({ where: (t, { inArray: inA }) => inA(t.id, debateIds) })
      : [];
  const roundIds = [...new Set(debateRows.map((d) => d.roundId))];
  const [roundRows, ballotRows] = await Promise.all([
    roundIds.length ? db.select().from(rounds).where(inArray(rounds.id, roundIds)) : Promise.resolve([]),
    debateIds.length ? db.select().from(ballots).where(inArray(ballots.debateId, debateIds)) : Promise.resolve([]),
  ]);
  const released = new Map(roundRows.filter((r) => r.drawStatus === "published").map((r) => [r.id, r]));
  const visible = debateRows
    .filter((d) => released.has(d.roundId))
    .sort((a, b) => (released.get(b.roundId)!.number - released.get(a.roundId)!.number));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ballots"
        description="Enter the result for each debate you adjudicated. The tab team confirms it."
      />
      <ul className="divide-y border">
        {visible.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No debates to enter ballots for.</li>
        ) : null}
        {visible.map((d) => {
          const mine = ballotRows.filter((b) => b.debateId === d.id && !b.discarded);
          const confirmed = mine.find((b) => b.status === "accepted");
          const submitted = mine.find((b) => b.status === "submitted");
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{released.get(d.roundId)?.name}</p>
                <p className="font-medium">
                  {d.affirmativeTeamName ?? "—"} <span className="text-muted-foreground">v</span> {d.negativeTeamName ?? "—"}
                </p>
              </div>
              {confirmed ? (
                <Badge variant="secondary">
                  Confirmed {confirmed.affirmativePoints}–{confirmed.negativePoints}
                </Badge>
              ) : submitted ? (
                <>
                  <Badge variant="outline">Awaiting confirmation</Badge>
                  <Button size="sm" variant="outline" render={<Link href={`/adjudicator/ballots/${d.id}`} />}>
                    Edit
                  </Button>
                </>
              ) : (
                <Button size="sm" render={<Link href={`/adjudicator/ballots/${d.id}`} />}>
                  Enter ballot
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
