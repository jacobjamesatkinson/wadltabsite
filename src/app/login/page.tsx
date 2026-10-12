export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getAuthContext, homePathFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx?.status === "active") {
    const dest = homePathFor(ctx);
    if (dest) redirect(dest);
  }
  return <LoginForm />;
}
