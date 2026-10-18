import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  ballots,
  divisions,
  institutions,
  rounds,
  teams,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import {
  CoordinatorResultsTable,
  type CoordinatorResultsRow,
  type ResultsRoundColumn,
  type RoundResultCell,
} from "./coordinator-results-table";

export default async function CoordinatorResultsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);

  const [teamRows, institutionRows, divisionRows] = await Promise.all([
    ids.length > 0
      ? db.select().from(teams).where(inArray(teams.institutionId, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db.select().from(institutions).where(inArray(institutions.id, ids))
      : Promise.resolve([]),
    db.select().from(divisions),
  ]);

  const teamIds = teamRows.map((t) => t.id);
  const instMap = new Map(institutionRows.map((i) => [i.id, i]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d.name]));

  const allDebates =
    teamIds.length > 0
      ? await db.query.debates.findMany({
          where: (t, { or, inArray: ia }) =>
            or(ia(t.affirmativeTeamId, teamIds), ia(t.negativeTeamId, teamIds)),
        })
      : [];

  const debateIds = allDebates.map((d) => d.id);
  const [ballotRows, roundRows] = await Promise.all([
    debateIds.length > 0
      ? db
          .select()
          .from(ballots)
          .where(
            and(
              inArray(ballots.debateId, debateIds),
              eq(ballots.status, "accepted"),
              eq(ballots.discarded, false)
            )
          )
      : Promise.resolve([]),
    db.select().from(rounds),
  ]);

  const roundMap = new Map(roundRows.map((r) => [r.id, r]));
  const confirmedByDebate = new Map<string, (typeof ballotRows)[number]>();
  for (const b of ballotRows) {
    const prev = confirmedByDebate.get(b.debateId);
    if (!prev || b.version > prev.version) confirmedByDebate.set(b.debateId, b);
  }

  const resultsByTeam = new Map<string, Record<string, RoundResultCell>>();
  const roundsWithResults = new Set<string>();

  for (const debate of allDebates) {
    const ballot = confirmedByDebate.get(debate.id);
    if (!ballot?.winnerTeamId) continue;
    const round = roundMap.get(debate.roundId);
    if (!round) continue;

    const sides: Array<{ teamId: string | null; opponentName: string | null }> =
      [
        {
          teamId: debate.affirmativeTeamId,
          opponentName: debate.negativeTeamName,
        },
        {
          teamId: debate.negativeTeamId,
          opponentName: debate.affirmativeTeamName,
        },
      ];

    for (const side of sides) {
      if (!side.teamId || !teamIds.includes(side.teamId)) continue;
      const outcome: "won" | "lost" =
        ballot.winnerTeamId === side.teamId ? "won" : "lost";
      const map = resultsByTeam.get(side.teamId) ?? {};
      map[round.id] = {
        outcome,
        opponent: side.opponentName?.trim() || "—",
      };
      resultsByTeam.set(side.teamId, map);
      roundsWithResults.add(round.id);
    }
  }

  const resultRounds: ResultsRoundColumn[] = [...roundsWithResults]
    .map((id) => {
      const r = roundMap.get(id)!;
      return { id: r.id, name: r.name, number: r.number };
    })
    .sort((a, b) => a.number - b.number);

  const rows: CoordinatorResultsRow[] = teamRows
    .map((t) => {
      const institution = t.institutionId
        ? instMap.get(t.institutionId)
        : null;
      return {
        id: t.id,
        name: formatTeamDisplayName(t, institution ?? null),
        institution: institution?.name ?? "—",
        division: t.divisionId ? (divMap.get(t.divisionId) ?? "—") : "—",
        record: `${t.wins}–${t.losses}`,
        results: resultsByTeam.get(t.id) ?? {},
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results"
        description="Win/loss record for your teams across rounds with entered results"
      />
      {rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No teams at your institutions yet
        </div>
      ) : (
        <CoordinatorResultsTable rows={rows} rounds={resultRounds} />
      )}
    </div>
  );
}
