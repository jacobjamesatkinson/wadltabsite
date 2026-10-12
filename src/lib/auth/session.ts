import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";
import {
  loadAuthContext,
  hasPermission,
  homePathFor,
  type Permission,
} from "@/lib/permissions";
import type { AuthContext } from "@/lib/permissions/types";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return loadAuthContext(session.user.id);
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.status !== "active") {
    redirect("/login");
  }
  return ctx;
}

export async function requirePerm(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, permission)) {
    redirect(homePathFor(ctx));
  }
  return ctx;
}

export { homePathFor, hasPermission };
