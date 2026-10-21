import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  competitions,
  defaultCompetitionConfig,
  rounds,
} from "@/db/schema";

/** Stable singleton competition for this single-competition site. */
export const SITE_COMPETITION_ID = "comp_site";

export type SiteCompetition = typeof competitions.$inferSelect;

/**
 * Ensure the site competition row exists, then return it.
 * There is no multi-competition mode — callers can treat this as always present.
 * Idempotent under concurrent callers (e.g. parallel Next.js prerender workers).
 */
export async function ensureSiteCompetition(): Promise<SiteCompetition> {
  const [byId] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, SITE_COMPETITION_ID))
    .limit(1);
  if (byId) return byId;

  const [anyExisting] = await db
    .select()
    .from(competitions)
    .orderBy(asc(competitions.createdAt))
    .limit(1);
  if (anyExisting) return anyExisting;

  await db
    .insert(competitions)
    .values({
      id: SITE_COMPETITION_ID,
      name: "WADL",
      shortName: "WADL",
      season: new Date().getFullYear().toString(),
      status: "running",
      config: defaultCompetitionConfig,
    })
    .onConflictDoNothing({ target: competitions.id });

  const [created] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, SITE_COMPETITION_ID))
    .limit(1);
  if (created) return created;

  const [fallback] = await db
    .select()
    .from(competitions)
    .orderBy(asc(competitions.createdAt))
    .limit(1);
  if (fallback) return fallback;
  throw new Error("Failed to create site competition");
}

/** @deprecated Prefer ensureSiteCompetition — always returns the site competition. */
export async function getSiteCompetition() {
  return ensureSiteCompetition();
}

export async function requireSiteCompetition() {
  return ensureSiteCompetition();
}

export async function getSiteRounds() {
  const competition = await ensureSiteCompetition();
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
