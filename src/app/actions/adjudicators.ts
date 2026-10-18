"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import {
  account,
  adjudicatorAssignments,
  adjudicatorAvailability,
  adjudicatorProfiles,
  normalizeCompetitionConfig,
  user,
  userRoles,
} from "@/db/schema";
import { allocateAdjudicators, checkEligibility } from "@/lib/adjudicators/allocate";
import {
  loadAllocationData,
  toCandidates,
  toDebatesForAllocation,
} from "@/lib/adjudicators/load";
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

export async function deleteAdjudicatorProfiles(ids: string[]) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");

  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };

  for (const id of unique) {
    await db
      .delete(adjudicatorAssignments)
      .where(eq(adjudicatorAssignments.adjudicatorId, id));
    await db
      .delete(adjudicatorAvailability)
      .where(eq(adjudicatorAvailability.adjudicatorId, id));
    await db.delete(adjudicatorProfiles).where(eq(adjudicatorProfiles.id, id));
    await writeAudit({
      actorId: ctx.userId,
      action: "adjudicator.delete",
      entityType: "adjudicator_profile",
      entityId: id,
      details: { via: "bulk" },
    });
  }
  revalidatePath("/admin/adjudicators");
  return { deleted: unique.length };
}


function revalidateAllocation(roundId: string) {
  for (const p of [
    `/admin/rounds/${roundId}/adjudicators`,
    `/admin/rounds/${roundId}/display`,
    `/admin/rounds/${roundId}/draw`,
    "/admin/adjudicators",
    "/ha/draw",
    "/ha/ballots",
    "/adjudicator",
    "/public/draw",
    "/",
  ]) {
    revalidatePath(p);
  }
}

async function requireAllocator() {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "adjudicators:manage") && !hasPermission(ctx, "ha:venue_manage")) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}

/**
 * Set the adjudicator in a room. Enforces the same-timeslot lock and hard
 * conflicts; own-school is allowed but reported back as a warning.
 * Pass `adjudicatorId: null` to clear the slot (optionally a specific assignment).
 */
export async function setDebateAdjudicator(params: {
  debateId: string;
  adjudicatorId: string | null;
  /** Assignment being replaced/cleared; when omitted a new seat is added. */
  replaceAssignmentId?: string | null;
  role?: string;
}) {
  const ctx = await requireAllocator();
  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, params.debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");

  if (params.replaceAssignmentId) {
    await db
      .delete(adjudicatorAssignments)
      .where(eq(adjudicatorAssignments.id, params.replaceAssignmentId));
  }
  if (!params.adjudicatorId) {
    await writeAudit({
      actorId: ctx.userId,
      action: "adjudicator.unassign",
      entityType: "debate",
      entityId: debate.id,
      details: { assignmentId: params.replaceAssignmentId },
    });
    revalidateAllocation(debate.roundId);
    return { warnings: [] as string[] };
  }

  const data = await loadAllocationData(debate.roundId);
  const adj = data.adjudicators.find((a) => a.id === params.adjudicatorId);
  if (!adj) throw new Error("Adjudicator not found or inactive");
  const venue = data.venues.find((v) => v.cells.some((c) => c.debateId === debate.id));
  const cell = venue?.cells.find((c) => c.debateId === debate.id);
  if (!venue || !cell) throw new Error("Debate is not in the allocation grid");

  const candidate = toCandidates(data).find((c) => c.id === adj.id)!;
  // If moving within the same timeslot (replacing their own seat), unlock that slot.
  if (cell.timeslotId && adj.placements[cell.timeslotId]?.debateId === debate.id) {
    candidate.lockedTimeslotIds.delete(cell.timeslotId);
  }
  const eligibility = checkEligibility(candidate, {
    id: cell.debateId,
    venueId: venue.id,
    timeslotId: cell.timeslotId,
    affirmativeTeamId: cell.affirmativeTeamId,
    negativeTeamId: cell.negativeTeamId,
    institutionIds: cell.institutionIds,
    bracket: cell.bracket,
    currentAssignmentCount: cell.assignments.length,
  });
  if (!eligibility.ok) {
    throw new Error(`${adj.name}: ${eligibility.hard.join("; ")}`);
  }

  const already = cell.assignments.find((a) => a.adjudicatorId === adj.id);
  if (!already) {
    await db.insert(adjudicatorAssignments).values({
      id: createId("asg"),
      debateId: debate.id,
      adjudicatorId: adj.id,
      role: params.role ?? (cell.assignments.length === 0 ? "chair" : "panellist"),
    });
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.assign",
    entityType: "debate",
    entityId: debate.id,
    details: { adjudicatorId: adj.id, soft: eligibility.soft },
  });
  revalidateAllocation(debate.roundId);
  return { warnings: eligibility.soft.map((s) => `${adj.name}: ${s}`) };
}

/** Auto-allocate every unfilled room at a venue (or the whole round). */
export async function autoAllocateVenue(params: { roundId: string; venueId?: string | null }) {
  const ctx = await requireAllocator();
  const data = await loadAllocationData(params.roundId);
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, data.round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");

  const venuesToFill = params.venueId
    ? data.venues.filter((v) => v.id === params.venueId)
    : data.venues;
  const candidates = toCandidates(data);
  const result = allocateAdjudicators({
    debates: venuesToFill.flatMap(toDebatesForAllocation),
    adjudicators: candidates,
    config: normalizeCompetitionConfig(competition.config),
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
    entityId: params.roundId,
    details: {
      venueId: params.venueId ?? null,
      assigned: result.assignments.length,
      unfilled: result.unfilledDebateIds.length,
      warnings: result.warnings,
    },
  });
  revalidateAllocation(params.roundId);
  return {
    assigned: result.assignments.length,
    unfilled: result.unfilledDebateIds.length,
    warnings: result.warnings,
  };
}

/** Remove every allocation at a venue (or in the whole round). */
export async function clearVenueAllocation(params: { roundId: string; venueId?: string | null }) {
  const ctx = await requireAllocator();
  const data = await loadAllocationData(params.roundId);
  const venuesToClear = params.venueId
    ? data.venues.filter((v) => v.id === params.venueId)
    : data.venues;
  const debateIds = venuesToClear.flatMap((v) => v.cells.map((c) => c.debateId));
  if (debateIds.length > 0) {
    await db
      .delete(adjudicatorAssignments)
      .where(inArray(adjudicatorAssignments.debateId, debateIds));
  }
  await writeAudit({
    actorId: ctx.userId,
    action: "adjudicator.clear_allocation",
    entityType: "round",
    entityId: params.roundId,
    details: { venueId: params.venueId ?? null, debates: debateIds.length },
  });
  revalidateAllocation(params.roundId);
}
