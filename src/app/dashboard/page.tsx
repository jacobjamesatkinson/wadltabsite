import { redirect } from "next/navigation";
import { getAuthContext, homePathFor } from "@/lib/auth/session";

/** Demo dashboard-01 route redirects into the authenticated role home. */
export default async function DashboardRedirectPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  redirect(homePathFor(ctx) ?? "/login");
}
