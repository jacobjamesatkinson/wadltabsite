"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  competitions,
  defaultCompetitionConfig,
  divisions,
  rounds,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";

const createSchema = z.object({
  name: z.string().min(2),
  shortName: z.string().min(1).max(32),
  season: z.string().min(2),
});

export async function createCompetition(input: z.infer<typeof createSchema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const data = createSchema.parse(input);
  const id = createId("comp");
  await db.insert(competitions).values({
    id,
    name: data.name,
    shortName: data.shortName.toUpperCase(),
    season: data.season,
    status: "draft",
    config: defaultCompetitionConfig,
  });

  const defaultDivisions = [
    { name: "Novice A", sortOrder: 0, chipColor: "#3B82F6" },
    { name: "Junior A", sortOrder: 1, chipColor: "#10B981" },
    { name: "Senior A", sortOrder: 2, chipColor: "#F59E0B" },
  ];
  for (const div of defaultDivisions) {
    await db.insert(divisions).values({
      id: createId("div"),
      competitionId: id,
      name: div.name,
      sortOrder: div.sortOrder,
      chipColor: div.chipColor,
    });
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "competition.create",
    entityType: "competition",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/competitions");
  return { id };
}

/** Quick demo competition for local testing — unique short name each time. */
export async function createDummyCompetition() {
  const year = new Date().getFullYear().toString();
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return createCompetition({
    name: `Dummy Competition ${suffix}`,
    shortName: `DUMMY${suffix}`,
    season: year,
  });
}

export async function updateCompetitionStatus(id: string, status: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  if (status === "running") {
    const [otherRunning] = await db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(and(eq(competitions.status, "running"), ne(competitions.id, id)))
      .limit(1);
    if (otherRunning) {
      throw new Error(
        `Only one competition can run at a time. Stop "${otherRunning.name}" first.`
      );
    }
  }

  await db
    .update(competitions)
    .set({ status, updatedAt: new Date() })
    .where(eq(competitions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition.status",
    entityType: "competition",
    entityId: id,
    details: { status },
  });
  revalidatePath("/admin/competitions");
  revalidatePath(`/admin/competitions/${id}`);
}

export async function addRound(
  competitionId: string,
  name: string,
  number: number,
  startDate: string
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const { requireMondayStart } = await import("@/lib/roster/dates");
  const monday = requireMondayStart(startDate);

  const id = createId("rnd");
  await db.insert(rounds).values({
    id,
    competitionId,
    name,
    number,
    date: monday,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "round.create",
    entityType: "round",
    entityId: id,
    details: { competitionId, name, number, startDate },
  });
  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/admin/settings/rounds");
  revalidatePath("/admin/rounds", "layout");
  revalidatePath("/admin");
  return { id };
}

export async function updateCompetition(
  id: string,
  input: z.infer<typeof createSchema>
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const data = createSchema.parse(input);
  await db
    .update(competitions)
    .set({
      name: data.name,
      shortName: data.shortName.toUpperCase(),
      season: data.season,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition.update",
    entityType: "competition",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/competitions");
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath("/admin/settings");
}

/** Update the singleton site competition display name. */
export async function updateSiteCompetitionName(name: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const trimmed = z.string().min(2).max(200).parse(name.trim());
  const { ensureSiteCompetition } = await import("@/lib/competition");
  const competition = await ensureSiteCompetition();

  await db
    .update(competitions)
    .set({
      name: trimmed,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, competition.id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition.name",
    entityType: "competition",
    entityId: competition.id,
    details: { name: trimmed },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteCompetition(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  await db.delete(competitions).where(eq(competitions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition.delete",
    entityType: "competition",
    entityId: id,
  });
  revalidatePath("/admin/competitions");
  revalidatePath("/admin/rounds", "layout");
  revalidatePath("/admin/teams");
}

export async function deleteRound(roundId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");
  await db.delete(rounds).where(eq(rounds.id, roundId));
  await writeAudit({
    actorId: ctx.userId,
    action: "round.delete",
    entityType: "round",
    entityId: roundId,
    details: { competitionId: round.competitionId },
  });
  revalidatePath(`/admin/competitions/${round.competitionId}`);
  revalidatePath("/admin/settings/rounds");
  revalidatePath("/admin/rounds", "layout");
  revalidatePath("/admin");
}

export async function updateRound(
  roundId: string,
  input: { name: string; number: number; date: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");

  const { requireMondayStart } = await import("@/lib/roster/dates");
  const monday = requireMondayStart(input.date);

  await db
    .update(rounds)
    .set({
      name: input.name,
      number: input.number,
      date: monday,
    })
    .where(eq(rounds.id, roundId));

  await writeAudit({
    actorId: ctx.userId,
    action: "round.update",
    entityType: "round",
    entityId: roundId,
    details: input,
  });
  revalidatePath("/admin/settings/rounds");
  revalidatePath(`/admin/rounds/${roundId}/availability`);
  revalidatePath("/admin");
}

function normalizeChipColor(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(hex)) {
    throw new Error("Chip colour must be a hex value like #3B82F6");
  }
  return hex.toUpperCase();
}

export async function createDivision(input: {
  competitionId: string;
  name: string;
  sortOrder?: number;
  chipColor?: string | null;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const existing = await db.query.divisions.findMany({
    where: (t, { eq: e }) => e(t.competitionId, input.competitionId),
  });
  const nextSort =
    input.sortOrder ??
    (existing.length
      ? Math.max(...existing.map((d) => d.sortOrder)) + 1
      : 0);

  const id = createId("div");
  const chipColor = normalizeChipColor(input.chipColor);
  await db.insert(divisions).values({
    id,
    competitionId: input.competitionId,
    name: input.name.trim(),
    sortOrder: nextSort,
    chipColor,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "division.create",
    entityType: "division",
    entityId: id,
    details: { ...input, sortOrder: nextSort, chipColor },
  });
  revalidatePath("/admin/settings/divisions");
  revalidatePath("/");
  return { id };
}

export async function updateDivision(
  divisionId: string,
  input: {
    name?: string;
    sortOrder?: number;
    chipColor?: string | null;
  }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const division = await db.query.divisions.findFirst({
    where: (t, { eq: e }) => e(t.id, divisionId),
  });
  if (!division) throw new Error("NOT_FOUND");

  const patch: {
    name?: string;
    sortOrder?: number;
    chipColor?: string | null;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Division name required");
    patch.name = name;
  }
  if (input.sortOrder !== undefined) {
    if (!Number.isFinite(input.sortOrder)) {
      throw new Error("Sort order must be a number");
    }
    patch.sortOrder = Math.trunc(input.sortOrder);
  }
  if (input.chipColor !== undefined) {
    patch.chipColor = normalizeChipColor(input.chipColor);
  }

  if (Object.keys(patch).length === 0) return;

  await db.update(divisions).set(patch).where(eq(divisions.id, divisionId));
  await writeAudit({
    actorId: ctx.userId,
    action: "division.update",
    entityType: "division",
    entityId: divisionId,
    details: patch,
  });
  revalidatePath("/admin/settings/divisions");
  revalidatePath("/");
}

export async function deleteDivision(divisionId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const division = await db.query.divisions.findFirst({
    where: (t, { eq: e }) => e(t.id, divisionId),
  });
  if (!division) throw new Error("NOT_FOUND");

  const linkedTeam = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.divisionId, divisionId),
  });
  if (linkedTeam) {
    throw new Error("Cannot delete a division that still has teams");
  }

  await db.delete(divisions).where(eq(divisions.id, divisionId));
  await writeAudit({
    actorId: ctx.userId,
    action: "division.delete",
    entityType: "division",
    entityId: divisionId,
  });
  revalidatePath("/admin/settings/divisions");
  revalidatePath("/");
}

export async function updateCompetitionConfig(
  id: string,
  config: typeof defaultCompetitionConfig
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  await db
    .update(competitions)
    .set({ config, updatedAt: new Date() })
    .where(eq(competitions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition.config",
    entityType: "competition",
    entityId: id,
    details: config as unknown as Record<string, unknown>,
  });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath("/admin/settings");
}
