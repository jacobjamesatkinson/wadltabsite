"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";

const schema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().min(1).max(32),
});

export async function createInstitution(input: z.infer<typeof schema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "institutions:manage");

  const data = schema.parse(input);
  const id = createId("inst");
  await db.insert(institutions).values({
    id,
    name: data.name,
    shortName: data.shortName.trim(),
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "institution.create",
    entityType: "institution",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/institutions");
  return { id };
}

export async function updateInstitution(
  id: string,
  input: z.infer<typeof schema> & { status?: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "institutions:manage");

  const data = schema.extend({ status: z.string().optional() }).parse({ ...input, id });
  await db
    .update(institutions)
    .set({
      name: data.name,
      shortName: data.shortName.trim(),
      status: data.status ?? "active",
      updatedAt: new Date(),
    })
    .where(eq(institutions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "institution.update",
    entityType: "institution",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/institutions");
  revalidatePath(`/admin/institutions/${id}`);
}

export async function archiveInstitution(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "institutions:manage");

  await db
    .update(institutions)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(institutions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "institution.archive",
    entityType: "institution",
    entityId: id,
  });
  revalidatePath("/admin/institutions");
  revalidatePath(`/admin/institutions/${id}`);
}

export async function deleteInstitution(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "institutions:manage");

  const linkedTeams = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.institutionId, id),
  });
  if (linkedTeams) {
    throw new Error("Cannot delete institution with teams — archive it instead");
  }

  await db.delete(institutions).where(eq(institutions.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "institution.delete",
    entityType: "institution",
    entityId: id,
  });
  revalidatePath("/admin/institutions");
}

export async function deleteInstitutions(ids: string[]) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "institutions:manage");

  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };

  for (const id of unique) {
    const linkedTeams = await db.query.teams.findFirst({
      where: (t, { eq: e }) => e(t.institutionId, id),
    });
    if (linkedTeams) {
      const inst = await db.query.institutions.findFirst({
        where: (t, { eq: e }) => e(t.id, id),
      });
      throw new Error(
        `Cannot delete ${inst?.shortName ?? id} — it still has teams`
      );
    }
  }

  for (const id of unique) {
    await db.delete(institutions).where(eq(institutions.id, id));
    await writeAudit({
      actorId: ctx.userId,
      action: "institution.delete",
      entityType: "institution",
      entityId: id,
      details: { via: "bulk" },
    });
  }
  revalidatePath("/admin/institutions");
  return { deleted: unique.length };
}
