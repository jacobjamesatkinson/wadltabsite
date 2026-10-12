import { AppShell } from "@/components/layout/app-shell";
import { coordinatorNav } from "@/components/nav/nav-config";
import { requirePerm } from "@/lib/auth/session";

export { dynamic, runtime } from "@/lib/db-dynamic";

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePerm("teams:view_own");
  return (
    <AppShell ctx={ctx} items={coordinatorNav} title="Coordinator">
      {children}
    </AppShell>
  );
}
