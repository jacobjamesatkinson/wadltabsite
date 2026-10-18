"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { competitionTimeslots } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";
import {
  parseTimeslotTime,
  timeslotMinutes,
} from "@/lib/timeslots/format";

export async function createCompetitionTimeslot(input: {
  competitionId: string;
  startsAt: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const data = z
    .object({
      competitionId: z.string(),
      startsAt: z.string().min(1),
    })
    .parse(input);

  const startsAt = parseTimeslotTime(data.startsAt);
  const sortOrder = timeslotMinutes(startsAt);

  const duplicate = await db
    .select()
    .from(competitionTimeslots)
    .where(eq(competitionTimeslots.competitionId, data.competitionId));
  if (duplicate.some((s) => s.startsAt === startsAt)) {
    throw new Error("A timeslot already exists for that time");
  }

  const id = createId("cts");
  await db.insert(competitionTimeslots).values({
    id,
    competitionId: data.competitionId,
    startsAt,
    sortOrder,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "competition_timeslot.create",
    entityType: "competition_timeslot",
    entityId: id,
    details: { competitionId: data.competitionId, startsAt, sortOrder },
  });
  revalidatePath("/admin/timeslots");
  revalidatePath("/admin/teams");
  revalidatePath("/");
  return { id };
}

export async function updateCompetitionTimeslot(
  id: string,
  input: { startsAt: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const data = z.object({ startsAt: z.string().min(1) }).parse(input);
  const startsAt = parseTimeslotTime(data.startsAt);
  const sortOrder = timeslotMinutes(startsAt);

  const [slot] = await db
    .select()
    .from(competitionTimeslots)
    .where(eq(competitionTimeslots.id, id))
    .limit(1);
  if (!slot) throw new Error("NOT_FOUND");

  const siblings = await db
    .select()
    .from(competitionTimeslots)
    .where(eq(competitionTimeslots.competitionId, slot.competitionId));
  if (siblings.some((s) => s.id !== id && s.startsAt === startsAt)) {
    throw new Error("A timeslot already exists for that time");
  }

  await db
    .update(competitionTimeslots)
    .set({ startsAt, sortOrder })
    .where(eq(competitionTimeslots.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition_timeslot.update",
    entityType: "competition_timeslot",
    entityId: id,
    details: { startsAt, sortOrder },
  });
  revalidatePath("/admin/timeslots");
  revalidatePath("/admin/teams");
  revalidatePath("/");
}

export async function deleteCompetitionTimeslot(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "competitions:manage");

  const linked = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.timeslotId, id),
  });
  if (linked) {
    throw new Error("Cannot delete a timeslot still assigned to teams");
  }

  await db.delete(competitionTimeslots).where(eq(competitionTimeslots.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "competition_timeslot.delete",
    entityType: "competition_timeslot",
    entityId: id,
  });
  revalidatePath("/admin/timeslots");
  revalidatePath("/admin/teams");
  revalidatePath("/");
}
