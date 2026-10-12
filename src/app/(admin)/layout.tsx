import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/components/nav/nav-config";
import { requirePerm } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
