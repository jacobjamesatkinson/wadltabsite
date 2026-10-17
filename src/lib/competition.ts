import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { competitions, rounds } from "@/db/schema";

/** Single-competition sites always operate against the first (only) competition. */
export async function getSiteCompetition() {
  const [competition] = await db
    .select()
    .from(competitions)
    .orderBy(asc(competitions.createdAt))
    .limit(1);
  return competition ?? null;
}

export async function requireSiteCompetition() {
  const competition = await getSiteCompetition();
  if (!competition) {
    throw new Error("No competition configured for this site");
  }
  return competition;
}

export async function getSiteRounds() {
  const competition = await getSiteCompetition();
  if (!competition) return [];
  return db
    .select({
      id: rounds.id,
      name: rounds.name,
      number: rounds.number,
      drawStatus: rounds.drawStatus,
    })
    .from(rounds)
    .where(eq(rounds.competitionId, competition.id))
    .orderBy(asc(rounds.number));
}
