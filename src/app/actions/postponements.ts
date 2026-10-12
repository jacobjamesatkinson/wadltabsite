"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postponementRequests } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import {
  canAccessInstitution,
  hasPermission,
  requirePermission,
} from "@/lib/permissions";

export async function requestPostponement(debateId: string, reason: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "postponements:request");

  const data = z
    .object({ debateId: z.string(), reason: z.string().min(3) })
    .parse({ debateId, reason });

  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, data.debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");

  const teamIds = [debate.affirmativeTeamId, debate.negativeTeamId].filter(Boolean) as string[];
  const teamRows = await db.query.teams.findMany({
    where: (t, { inArray }) => inArray(t.id, teamIds),
  });
  const own = teamRows.find((t) => canAccessInstitution(ctx, t.institutionId));
  if (!own && !hasPermission(ctx, "admin:manage")) throw new Error("FORBIDDEN");

  const id = createId("pp");
  await db.insert(postponementRequests).values({
    id,
    debateId: data.debateId,
    requestedBy: ctx.userId,
    institutionId: own?.institutionId ?? teamRows[0]!.institutionId,
    reason: data.reason,
    status: "pending",
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "postponement.request",
    entityType: "postponement_request",
    entityId: id,
    details: data,
  });
  revalidatePath("/coordinator/postponements");
  return { id };
}

export async function decidePostponement(
  id: string,
  status: "approved" | "rejected",
  notes?: string
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "postponements:review");

  await db
    .update(postponementRequests)
    .set({
      status,
      decisionNotes: notes,
      decidedBy: ctx.userId,
      decidedAt: new Date(),
    })
    .where(eq(postponementRequests.id, id));

  // Does NOT auto-mutate the draw — admin must adjust manually
  await writeAudit({
    actorId: ctx.userId,
    action: "postponement.decide",
    entityType: "postponement_request",
    entityId: id,
    details: { status, notes },
  });
  revalidatePath("/coordinator/postponements");
  revalidatePath("/admin/draws");
}
