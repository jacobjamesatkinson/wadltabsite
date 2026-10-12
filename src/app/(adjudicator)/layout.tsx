import { AppShell } from "@/components/layout/app-shell";
import { adjudicatorNav } from "@/components/nav/nav-config";
import { requirePerm } from "@/lib/auth/session";

export { dynamic, runtime } from "@/lib/db-dynamic";

export default async function AdjudicatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePerm("ballots:submit");
  return (
    <AppShell ctx={ctx} items={adjudicatorNav} title="Adjudicator">
      {children}
    </AppShell>
  );
}
