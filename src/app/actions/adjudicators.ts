"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import {
  account,
  adjudicatorAssignments,
  adjudicatorAvailability,
  adjudicatorProfiles,
  debates,
  teams,
  user,
  userRoles,
} from "@/db/schema";
import { allocateAdjudicators } from "@/lib/adjudicators/allocate";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function createAdjudicator(input: {
  name: string;
  email: string;
  password?: string;
  qualifications?: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");
  const data = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8).optional(),
      qualifications: z.string().optional(),
    })
    .parse(input);

  let u = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.email, data.email.toLowerCase()),
  });
  if (!u) {
    const userId = createId("usr");
    await db.insert(user).values({
      id: userId,
      name: data.name,
      email: data.email.toLowerCase(),
      emailVerified: true,
      status: "active",
    });
    if (data.password) {
      await db.insert(account).values({
        id: createId("acc"),
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(data.password),
      });
    }
    u = (await db.query.user.findFirst({
      where: (t, { eq: e }) => e(t.id, userId),
    }))!;
  }

  const existingRole = await db.query.userRoles.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.userId, u!.id), e(t.role, "adjudicator")),
  });
  if (!existingRole) {
    await db.insert(userRoles).values({
      id: createId("role"),
      userId: u.id,
      role: "adjudicator",
    });
  }

  const existingProfile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, u!.id),
  });
  if (existingProfile) throw new Error("Adjudicator profile already exists");

  const id = createId("adj");
  await db.insert(adjudicatorProfiles).values({
    id,
    userId: u.id,
    qualifications: data.qualifications,
    active: true,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.create",
    entityType: "adjudicator_profile",
    entityId: id,
    details: { email: data.email },
  });
  revalidatePath("/admin/adjudicators");
  revalidatePath("/admin/accounts");
  return { id };
}

export async function updateAdjudicatorProfile(
  id: string,
  input: { qualifications?: string; notes?: string; active?: boolean; name?: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");
  const data = z
    .object({
      qualifications: z.string().optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
      name: z.string().min(1).optional(),
    })
    .parse(input);

  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!profile) throw new Error("NOT_FOUND");

  await db
    .update(adjudicatorProfiles)
    .set({
      qualifications: data.qualifications ?? profile.qualifications,
      notes: data.notes ?? profile.notes,
      active: data.active ?? profile.active,
    })
    .where(eq(adjudicatorProfiles.id, id));

  if (data.name) {
    await db
      .update(user)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(user.id, profile.userId));
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.update",
    entityType: "adjudicator_profile",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/adjudicators");
}

export async function deleteAdjudicatorProfile(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");
  await db.delete(adjudicatorAssignments).where(eq(adjudicatorAssignments.adjudicatorId, id));
  await db.delete(adjudicatorAvailability).where(eq(adjudicatorAvailability.adjudicatorId, id));
  await db.delete(adjudicatorProfiles).where(eq(adjudicatorProfiles.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.delete",
    entityType: "adjudicator_profile",
    entityId: id,
  });
  revalidatePath("/admin/adjudicators");
}

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
