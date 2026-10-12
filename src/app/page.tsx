export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { LinkButton } from "@/components/link-button";
import { getAuthContext, homePathFor } from "@/lib/auth/session";

export default async function HomePage() {
  const ctx = await getAuthContext();
  if (ctx?.status === "active") {
    const dest = homePathFor(ctx);
    if (dest) redirect(dest);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Western Australian Debating League
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            WADL Tab
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Competition management, draw generation, adjudicator allocation and
            results for school debating seasons.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/login">Sign in</LinkButton>
          <LinkButton href="/public/draw" variant="outline">
            Public draw
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
