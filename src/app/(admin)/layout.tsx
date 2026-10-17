import { requirePerm } from "@/lib/auth/session";
import { adminSetupNav, adminSettingsNav } from "@/components/nav/nav-config";
import { AppShell } from "@/components/layout/app-shell";
import { getSiteRounds } from "@/lib/competition";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePerm("admin:manage");
  const rounds = await getSiteRounds();

  return (
    <AppShell
      ctx={ctx}
      items={adminSetupNav}
      rounds={rounds}
      settingsItems={adminSettingsNav}
      title="Administrator"
    >
      {children}
    </AppShell>
  );
}
