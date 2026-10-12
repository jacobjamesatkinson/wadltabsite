"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import {
  account,
  adjudicatorProfiles,
  institutionMemberships,
  invitations,
  user,
  userRoles,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions/types";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "coordinator", "adjudicator", "head_adjudicator"]),
  institutionIds: z.array(z.string()).optional().default([]),
});

async function upsertCredentialPassword(userId: string, password: string) {
  const hashed = await hashPassword(password);
  const existing = await db.query.account.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.userId, userId), e(t.providerId, "credential")),
  });
  if (existing) {
    await db
      .update(account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(account.id, existing.id));
  } else {
    await db.insert(account).values({
      id: createId("acc"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    });
  }
}

export async function createAccount(input: z.infer<typeof createUserSchema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  const data = createUserSchema.parse(input);

  if (data.role === "coordinator" && data.institutionIds.length === 0) {
    throw new Error("Assign at least one institution for a coordinator");
  }

  const existing = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.email, data.email.toLowerCase()),
  });
  if (existing) throw new Error("A user with that email already exists");

  const userId = createId("usr");
  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email.toLowerCase(),
    emailVerified: true,
    status: "active",
  });
  await upsertCredentialPassword(userId, data.password);

  if (data.role === "coordinator") {
    for (const institutionId of data.institutionIds) {
      await db.insert(userRoles).values({
        id: createId("role"),
        userId,
        role: "coordinator",
        institutionId,
      });
      await db.insert(institutionMemberships).values({
        id: createId("mem"),
        userId,
        institutionId,
        permission: "coordinator",
      });
    }
  } else {
    await db.insert(userRoles).values({
      id: createId("role"),
      userId,
      role: data.role,
    });
    if (data.role === "adjudicator") {
      await db.insert(adjudicatorProfiles).values({
        id: createId("adj"),
        userId,
        active: true,
      });
    }
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "account.create",
    entityType: "user",
    entityId: userId,
    details: { email: data.email, role: data.role, institutionIds: data.institutionIds },
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/adjudicators");
  return { id: userId };
}

export async function setUserPassword(userId: string, password: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  const data = z.object({ password: z.string().min(8) }).parse({ password });
  const existing = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.id, userId),
  });
  if (!existing) throw new Error("NOT_FOUND");
  await upsertCredentialPassword(userId, data.password);
  await writeAudit({
    actorId: ctx.userId,
    action: "account.password_set",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/accounts");
}

export async function updateUserStatus(userId: string, status: "active" | "disabled") {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  await db
    .update(user)
    .set({ status, updatedAt: new Date() })
    .where(eq(user.id, userId));
  await writeAudit({
    actorId: ctx.userId,
    action: "account.status",
    entityType: "user",
    entityId: userId,
    details: { status },
  });
  revalidatePath("/admin/accounts");
}

export async function updateUserProfile(
  userId: string,
  input: { name: string; email: string }
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  const data = z
    .object({ name: z.string().min(1), email: z.string().email() })
    .parse(input);
  await db
    .update(user)
    .set({
      name: data.name,
      email: data.email.toLowerCase(),
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  await writeAudit({
    actorId: ctx.userId,
    action: "account.update",
    entityType: "user",
    entityId: userId,
    details: data,
  });
  revalidatePath("/admin/accounts");
}

export async function assignCoordinatorInstitution(
  userId: string,
  institutionId: string
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");

  const target = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.id, userId),
  });
  if (!target) throw new Error("NOT_FOUND");

  const existingRole = await db.query.userRoles.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.userId, userId), e(t.role, "coordinator"), e(t.institutionId, institutionId)),
  });
  if (!existingRole) {
    await db.insert(userRoles).values({
      id: createId("role"),
      userId,
      role: "coordinator",
      institutionId,
    });
  }

  const existingMembership = await db.query.institutionMemberships.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.userId, userId), e(t.institutionId, institutionId)),
  });
  if (!existingMembership) {
    await db.insert(institutionMemberships).values({
      id: createId("mem"),
      userId,
      institutionId,
      permission: "coordinator",
    });
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "account.assign_institution",
    entityType: "user",
    entityId: userId,
    details: { institutionId },
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/institutions");
}

export async function removeCoordinatorInstitution(
  userId: string,
  institutionId: string
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");

  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, "coordinator"),
        eq(userRoles.institutionId, institutionId)
      )
    );
  await db
    .delete(institutionMemberships)
    .where(
      and(
        eq(institutionMemberships.userId, userId),
        eq(institutionMemberships.institutionId, institutionId)
      )
    );

  await writeAudit({
    actorId: ctx.userId,
    action: "account.unassign_institution",
    entityType: "user",
    entityId: userId,
    details: { institutionId },
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/institutions");
}

export async function addUserRole(
  userId: string,
  role: AppRole,
  institutionId?: string
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");

  if (role === "coordinator") {
    if (!institutionId) throw new Error("Institution required for coordinator");
    await assignCoordinatorInstitution(userId, institutionId);
    return;
  }

  const existing = await db.query.userRoles.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.userId, userId), e(t.role, role)),
  });
  if (!existing) {
    await db.insert(userRoles).values({
      id: createId("role"),
      userId,
      role,
    });
  }
  if (role === "adjudicator") {
    const profile = await db.query.adjudicatorProfiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    if (!profile) {
      await db.insert(adjudicatorProfiles).values({
        id: createId("adj"),
        userId,
        active: true,
      });
    }
  }
  await writeAudit({
    actorId: ctx.userId,
    action: "account.role_add",
    entityType: "user",
    entityId: userId,
    details: { role, institutionId },
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/adjudicators");
}

export async function removeUserRole(roleId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  const role = await db.query.userRoles.findFirst({
    where: (t, { eq: e }) => e(t.id, roleId),
  });
  if (!role) throw new Error("NOT_FOUND");
  await db.delete(userRoles).where(eq(userRoles.id, roleId));
  if (role.role === "coordinator" && role.institutionId) {
    await db
      .delete(institutionMemberships)
      .where(
        and(
          eq(institutionMemberships.userId, role.userId),
          eq(institutionMemberships.institutionId, role.institutionId)
        )
      );
  }
  await writeAudit({
    actorId: ctx.userId,
    action: "account.role_remove",
    entityType: "user_role",
    entityId: roleId,
    details: { userId: role.userId, role: role.role },
  });
  revalidatePath("/admin/accounts");
}

export async function deleteAccount(userId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  if (userId === ctx.userId) throw new Error("Cannot delete your own account");

  await db.delete(adjudicatorProfiles).where(eq(adjudicatorProfiles.userId, userId));
  await db.delete(institutionMemberships).where(eq(institutionMemberships.userId, userId));
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db.delete(user).where(eq(user.id, userId));
  await writeAudit({
    actorId: ctx.userId,
    action: "account.delete",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/adjudicators");
}

export async function deleteInvitation(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "accounts:manage");
  await db.delete(invitations).where(eq(invitations.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "invitation.delete",
    entityType: "invitation",
    entityId: id,
  });
  revalidatePath("/admin/accounts");
}
