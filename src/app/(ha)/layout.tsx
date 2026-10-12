import { AppShell } from "@/components/layout/app-shell";
import { haNav } from "@/components/nav/nav-config";
import { requirePerm } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePerm("ha:venue_manage");
  return (
    <AppShell ctx={ctx} items={haNav} title="Head adjudicator">
      {children}
    </AppShell>
  );
}
