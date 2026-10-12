import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { institutionMemberships, userRoles } from "@/db/schema";
import type { AuthContext, Permission, RoleAssignment } from "./types";

export type { AuthContext, Permission, RoleAssignment, AppRole } from "./types";

const ROLE_PERMISSIONS: Record<RoleAssignment["role"], Permission[]> = {
  admin: [
    "admin:manage",
    "institutions:manage",
    "teams:manage_all",
    "competitions:manage",
    "draws:manage",
    "draws:view_published",
    "venues:manage",
    "adjudicators:manage",
    "ballots:review",
    "results:manage",
    "audit:view",
    "accounts:manage",
    "postponements:review",
    "ha:venue_manage",
  ],
  coordinator: [
    "institutions:view_own",
    "teams:manage_own",
    "teams:view_own",
    "draws:view_published",
    "postponements:request",
  ],
  adjudicator: [
    "adjudicators:availability",
    "ballots:submit",
    "draws:view_published",
  ],
  head_adjudicator: [
    "ha:venue_manage",
    "venues:manage",
    "adjudicators:manage",
    "ballots:review",
    "ballots:submit",
    "draws:view_published",
    "results:manage",
  ],
};

export function permissionsForRoles(roles: RoleAssignment[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_PERMISSIONS[r.role] ?? []) {
      set.add(p);
    }
  }
  return set;
}

export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  if (ctx.status !== "active") return false;
  return permissionsForRoles(ctx.roles).has(permission);
}

export function requirePermission(ctx: AuthContext, permission: Permission) {
  if (!hasPermission(ctx, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export function institutionIdsFor(ctx: AuthContext): string[] {
  const ids = new Set<string>();
  for (const r of ctx.roles) {
    if (r.role === "coordinator" && r.institutionId) {
      ids.add(r.institutionId);
    }
  }
  return [...ids];
}

export function canAccessInstitution(ctx: AuthContext, institutionId: string): boolean {
  if (hasPermission(ctx, "institutions:manage")) return true;
  return institutionIdsFor(ctx).includes(institutionId);
}

export function canAccessCompetitionAsHA(
  ctx: AuthContext,
  competitionId: string,
  venueId?: string | null
): boolean {
  if (hasPermission(ctx, "admin:manage")) return true;
  return ctx.roles.some(
    (r) =>
      r.role === "head_adjudicator" &&
      (r.competitionId === competitionId || !r.competitionId) &&
      (!venueId || !r.venueId || r.venueId === venueId)
  );
}

export async function loadAuthContext(userId: string): Promise<AuthContext | null> {
  const u = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.id, userId),
  });
  if (!u) return null;

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const memberships = await db
    .select()
    .from(institutionMemberships)
    .where(eq(institutionMemberships.userId, userId));

  const roleAssignments: RoleAssignment[] = roles.map((r) => ({
    role: r.role,
    institutionId: r.institutionId,
    competitionId: r.competitionId,
    venueId: r.venueId,
    divisionId: r.divisionId,
  }));

  // Ensure coordinator memberships surface as coordinator roles when missing
  for (const m of memberships) {
    const exists = roleAssignments.some(
      (r) => r.role === "coordinator" && r.institutionId === m.institutionId
    );
    if (!exists) {
      roleAssignments.push({
        role: "coordinator",
        institutionId: m.institutionId,
      });
    }
  }

  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    roles: roleAssignments,
  };
}

export function primaryRole(ctx: AuthContext): RoleAssignment["role"] | null {
  const order: RoleAssignment["role"][] = [
    "admin",
    "head_adjudicator",
    "coordinator",
    "adjudicator",
  ];
  for (const role of order) {
    if (ctx.roles.some((r) => r.role === role)) return role;
  }
  return null;
}

/** Workspace home for the user's primary role, or null if they have no role. */
export function homePathFor(ctx: AuthContext): string | null {
  const role = primaryRole(ctx);
  switch (role) {
    case "admin":
      return "/admin";
    case "head_adjudicator":
      return "/ha";
    case "coordinator":
      return "/coordinator";
    case "adjudicator":
      return "/adjudicator";
    default:
      return null;
  }
}

export { and, eq };
