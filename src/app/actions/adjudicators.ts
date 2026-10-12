"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorAvailability,
  adjudicatorProfiles,
  debates,
  teams,
} from "@/db/schema";
import { allocateAdjudicators } from "@/lib/adjudicators/allocate";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function setAvailability(
  adjudicatorId: string,
  timeslotId: string,
  available: boolean
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.id, adjudicatorId),
  });
  if (!profile) throw new Error("NOT_FOUND");

  if (profile.userId !== ctx.userId && !hasPermission(ctx, "adjudicators:manage")) {
    throw new Error("FORBIDDEN");
  }

  const existing = await db.query.adjudicatorAvailability.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.adjudicatorId, adjudicatorId), e(t.timeslotId, timeslotId)),
  });
  if (existing) {
    await db
      .update(adjudicatorAvailability)
      .set({ available })
      .where(eq(adjudicatorAvailability.id, existing.id));
  } else {
    await db.insert(adjudicatorAvailability).values({
      id: createId("av"),
      adjudicatorId,
      timeslotId,
      available,
    });
  }
  revalidatePath("/adjudicator/availability");
}

export async function assignAdjudicator(debateId: string, adjudicatorId: string, role = "chair") {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "adjudicators:manage") && !hasPermission(ctx, "ha:venue_manage")) {
    throw new Error("FORBIDDEN");
  }

  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");

  // Double-book check
  if (debate.timeslotId) {
    const sameSlot = await db
      .select({ id: debates.id })
      .from(debates)
      .innerJoin(adjudicatorAssignments, eq(adjudicatorAssignments.debateId, debates.id))
      .where(
        and(
          eq(debates.timeslotId, debate.timeslotId),
          eq(adjudicatorAssignments.adjudicatorId, adjudicatorId)
        )
      );
    if (sameSlot.length > 0) {
      throw new Error("Adjudicator already assigned in this timeslot");
    }
  }

  await db.insert(adjudicatorAssignments).values({
    id: createId("asg"),
    debateId,
    adjudicatorId,
    role,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.assign",
    entityType: "debate",
    entityId: debateId,
    details: { adjudicatorId, role },
  });
  revalidatePath("/ha/draw");
  revalidatePath("/admin/adjudicators");
  revalidatePath("/adjudicator");
}

export async function removeAssignment(assignmentId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "adjudicators:manage") && !hasPermission(ctx, "ha:venue_manage")) {
    throw new Error("FORBIDDEN");
  }
  await db.delete(adjudicatorAssignments).where(eq(adjudicatorAssignments.id, assignmentId));
  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.unassign",
    entityType: "adjudicator_assignment",
    entityId: assignmentId,
  });
  revalidatePath("/ha/draw");
  revalidatePath("/admin/adjudicators");
}

export async function autoAllocateRound(roundId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");

  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");

  const roundDebates = await db.select().from(debates).where(eq(debates.roundId, roundId));
  const profiles = await db.select().from(adjudicatorProfiles).where(eq(adjudicatorProfiles.active, true));
  const avail = await db.select().from(adjudicatorAvailability);
  const existing = await db.select().from(adjudicatorAssignments);

  const teamRows = await db.select().from(teams);

  const result = allocateAdjudicators({
    debates: roundDebates.map((d) => {
      const aff = teamRows.find((t) => t.id === d.affirmativeTeamId);
      const neg = teamRows.find((t) => t.id === d.negativeTeamId);
      return {
        id: d.id,
        timeslotId: d.timeslotId,
        affirmativeTeamId: d.affirmativeTeamId,
        negativeTeamId: d.negativeTeamId,
        institutionIds: [aff?.institutionId, neg?.institutionId].filter(Boolean) as string[],
        currentAssignmentCount: existing.filter((e) => e.debateId === d.id).length,
      };
    }),
    adjudicators: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      assignmentCount: existing.filter((e) => e.adjudicatorId === p.id).length,
      conflictInstitutionIds: [],
      conflictTeamIds: [],
      availableTimeslotIds: new Set(
        avail.filter((a) => a.adjudicatorId === p.id && a.available).map((a) => a.timeslotId)
      ),
    })),
    config: competition.config,
  });

  for (const a of result.assignments) {
    await db.insert(adjudicatorAssignments).values({
      id: createId("asg"),
      debateId: a.debateId,
      adjudicatorId: a.adjudicatorId,
      role: a.role,
    });
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.auto_allocate",
    entityType: "round",
    entityId: roundId,
    details: {
      assigned: result.assignments.length,
      unfilled: result.unfilledDebateIds,
      warnings: result.warnings,
    },
  });

  revalidatePath("/ha/draw");
  revalidatePath("/admin/adjudicators");
  revalidatePath("/admin/draws");
  return result;
}
