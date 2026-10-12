import { describe, expect, it } from "vitest";
import {
  canAccessInstitution,
  hasPermission,
  permissionsForRoles,
  primaryRole,
} from "./index";
import type { AuthContext } from "./types";

function ctx(partial: Partial<AuthContext> & Pick<AuthContext, "roles">): AuthContext {
  return {
    userId: "u1",
    email: "t@example.com",
    name: "Test",
    status: "active",
    ...partial,
  };
}

describe("permissions", () => {
  it("grants admin full manage permissions", () => {
    const c = ctx({ roles: [{ role: "admin" }] });
    expect(hasPermission(c, "draws:manage")).toBe(true);
    expect(hasPermission(c, "accounts:manage")).toBe(true);
    expect(permissionsForRoles(c.roles).has("audit:view")).toBe(true);
  });

  it("scopes coordinators to own institutions", () => {
    const c = ctx({
      roles: [{ role: "coordinator", institutionId: "inst-a" }],
    });
    expect(hasPermission(c, "teams:manage_own")).toBe(true);
    expect(hasPermission(c, "draws:manage")).toBe(false);
    expect(canAccessInstitution(c, "inst-a")).toBe(true);
    expect(canAccessInstitution(c, "inst-b")).toBe(false);
  });

  it("denies disabled accounts even with roles", () => {
    const c = ctx({
      status: "disabled",
      roles: [{ role: "admin" }],
    });
    expect(hasPermission(c, "admin:manage")).toBe(false);
  });

  it("picks primary role for home routing", () => {
    const c = ctx({
      roles: [
        { role: "adjudicator" },
        { role: "coordinator", institutionId: "x" },
        { role: "admin" },
      ],
    });
    expect(primaryRole(c)).toBe("admin");
  });

  it("does not give head adjudicators system admin", () => {
    const c = ctx({
      roles: [{ role: "head_adjudicator", competitionId: "c1" }],
    });
    expect(hasPermission(c, "ha:venue_manage")).toBe(true);
    expect(hasPermission(c, "accounts:manage")).toBe(false);
    expect(hasPermission(c, "admin:manage")).toBe(false);
  });
});
