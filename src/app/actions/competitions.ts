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
  timeslots,
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

  for (const name of ["Novice A", "Junior A", "Senior A"]) {
    await db.insert(divisions).values({
      id: createId("div"),
      competitionId: id,
      name,
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

export async function addRound(competitionId: string, name: string, number: number) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const id = createId("rnd");
  await db.insert(rounds).values({
    id,
    competitionId,
    name,
    number,
    date: new Date(),
  });
  const start = new Date();
  start.setHours(16, 0, 0, 0);
  await db.insert(timeslots).values({
    id: createId("ts"),
    roundId: id,
    label: "4:00 PM",
    startsAt: start,
    sortOrder: 0,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "round.create",
    entityType: "round",
    entityId: id,
    details: { competitionId, name, number },
  });
  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/admin/settings/rounds");
  revalidatePath("/admin/draws");
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
  revalidatePath("/admin/draws");
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
  await db.delete(timeslots).where(eq(timeslots.roundId, roundId));
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
  revalidatePath("/admin/draws");
  revalidatePath("/admin");
}

export async function updateRound(
  roundId: string,
  input: { name: string; number: number; date?: string | null }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");

  await db
    .update(rounds)
    .set({
      name: input.name,
      number: input.number,
      date: input.date ? new Date(input.date) : round.date,
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

export async function createDivision(input: {
  competitionId: string;
  name: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const id = createId("div");
  await db.insert(divisions).values({
    id,
    competitionId: input.competitionId,
    name: input.name.trim(),
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "division.create",
    entityType: "division",
    entityId: id,
    details: input,
  });
  revalidatePath("/admin/settings/divisions");
  revalidatePath("/");
  return { id };
}

export async function updateDivision(
  divisionId: string,
  input: { name: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const division = await db.query.divisions.findFirst({
    where: (t, { eq: e }) => e(t.id, divisionId),
  });
  if (!division) throw new Error("NOT_FOUND");

  const name = input.name.trim();
  if (!name) throw new Error("Division name required");

  await db
    .update(divisions)
    .set({ name })
    .where(eq(divisions.id, divisionId));
  await writeAudit({
    actorId: ctx.userId,
    action: "division.update",
    entityType: "division",
    entityId: divisionId,
    details: { name },
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
