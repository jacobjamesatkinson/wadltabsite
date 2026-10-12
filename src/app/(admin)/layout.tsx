import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/components/nav/nav-config";
import { requirePerm } from "@/lib/auth/session";

export { dynamic, runtime } from "@/lib/db-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePerm("admin:manage");
  return (
    <AppShell ctx={ctx} items={adminNav} title="Administrator">
      {children}
    </AppShell>
  );
}
