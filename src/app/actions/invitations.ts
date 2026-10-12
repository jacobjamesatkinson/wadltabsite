"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";
import { generateRawToken, hashToken } from "@/lib/tokens";
import type { AppRole } from "@/lib/permissions/types";

export async function createInvitation(input: {
  email: string;
  role: AppRole;
  institutionId?: string;
  competitionId?: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");

  const data = z
    .object({
      email: z.string().email(),
      role: z.enum(["admin", "coordinator", "adjudicator", "head_adjudicator"]),
      institutionId: z.string().optional(),
      competitionId: z.string().optional(),
    })
    .parse(input);

  const raw = generateRawToken();
  const id = createId("inv");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await db.insert(invitations).values({
    id,
    email: data.email.toLowerCase(),
    role: data.role,
    institutionId: data.institutionId,
    competitionId: data.competitionId,
    tokenHash: hashToken(raw),
    invitedBy: ctx.userId,
    expiresAt,
  });

  await writeAudit({
    actorId: ctx.userId,
    action: "invitation.create",
    entityType: "invitation",
    entityId: id,
    details: { email: data.email, role: data.role },
  });

  revalidatePath("/admin/accounts");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { id, inviteUrl: `${base}/login?invite=${raw}` };
}
