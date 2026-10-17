import Image from "next/image";
import Link from "next/link";
import { getAuthContext, homePathFor } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/permissions/types";
import { LinkButton } from "@/components/link-button";

export async function SiteTopBar() {
  let ctx: AuthContext | null = null;
  try {
    ctx = await getAuthContext();
  } catch {
    // Stale cookie or transient DB error — treat as signed out
  }
  const dashboardHref =
    ctx?.status === "active" ? homePathFor(ctx) ?? "/admin" : null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image
            src="/wadl-logo.png"
            alt="Western Australian Debating League"
            width={140}
            height={48}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            WADL Tab
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {dashboardHref ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {ctx?.name}
              </span>
              <LinkButton href={dashboardHref} size="sm" variant="outline">
                Dashboard
              </LinkButton>
            </>
          ) : (
            <LinkButton href="/login" size="sm" variant="outline">
              Log in
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}
