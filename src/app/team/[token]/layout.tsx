export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { TeamPortalShell } from "@/components/layout/team-portal-shell";
import type { ClientNavItem } from "@/components/nav/nav-config";
import { loadTeamPortal } from "@/lib/team-portal/load";

export default async function TeamPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadTeamPortal(token);
  const base = `/team/${token}`;
  const items: ClientNavItem[] = [
    { title: "Draw", href: `${base}/draw`, icon: "CalendarDays" },
    { title: "Speakers", href: `${base}/speakers`, icon: "Users" },
    { title: "Results", href: `${base}/results`, icon: "ClipboardList" },
  ];

  return (
    <TeamPortalShell
      title={ctx.displayName}
      teamLabel={ctx.displayName}
      items={items}
    >
      {children}
    </TeamPortalShell>
  );
}
