import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ballots, byes, debates, rounds, teams } from "@/db/schema";

/**
 * Recompute wins/losses/speaker points/byes for every team in the competition
 * from confirmed (non-discarded) ballots and byes in released rounds.
 * Idempotent — safe to call after any ballot or draw change.
 */
export async function recomputeTeamStats(competitionId: string) {
  const teamRows = await db.select().from(teams).where(eq(teams.competitionId, competitionId));
  const roundRows = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.competitionId, competitionId), eq(rounds.drawStatus, "published")));
  const roundIds = roundRows.map((r) => r.id);

  const debateRows = roundIds.length
    ? await db.select().from(debates).where(inArray(debates.roundId, roundIds))
    : [];
  const debateIds = debateRows.map((d) => d.id);
  const confirmed = debateIds.length
    ? await db
        .select()
        .from(ballots)
        .where(
          and(
            inArray(ballots.debateId, debateIds),
            eq(ballots.status, "accepted"),
            eq(ballots.discarded, false)
          )
        )
    : [];
  const byeRows = roundIds.length
    ? await db.select().from(byes).where(inArray(byes.roundId, roundIds))
    : [];

  const stats = new Map(
    teamRows.map((t) => [t.id, { wins: 0, losses: 0, speaks: 0, byes: 0 }])
  );
  const debateMap = new Map(debateRows.map((d) => [d.id, d]));
  for (const b of confirmed) {
    const d = debateMap.get(b.debateId);
    if (!d?.affirmativeTeamId || !d.negativeTeamId) continue;
    const aff = stats.get(d.affirmativeTeamId);
    const neg = stats.get(d.negativeTeamId);
    if (!aff || !neg) continue;
    aff.speaks += b.affirmativePoints ?? 0;
    neg.speaks += b.negativePoints ?? 0;
    if (b.winnerTeamId === d.affirmativeTeamId) {
      aff.wins++;
      neg.losses++;
    } else if (b.winnerTeamId === d.negativeTeamId) {
      neg.wins++;
      aff.losses++;
    }
  }
  for (const b of byeRows) {
    const s = stats.get(b.teamId);
    if (s) s.byes++;
  }

  for (const t of teamRows) {
    const s = stats.get(t.id)!;
    if (
      t.wins === s.wins &&
      t.losses === s.losses &&
      t.speakerPoints === s.speaks &&
      t.byes === s.byes
    ) {
      continue;
    }
    await db
      .update(teams)
      .set({
        wins: s.wins,
        losses: s.losses,
        speakerPoints: s.speaks,
        byes: s.byes,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, t.id));
  }
}
