import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  institutionMemberships,
  teams,
  user,
  userRoles,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { InstitutionForm } from "../institution-form";
import { CoordinatorsTable } from "./coordinators-table";
import { InstitutionTeamsTable } from "./institution-teams-table";

export default async function InstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const institution = await db.query.institutions.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!institution) notFound();

  const [teamRows, memberships, roles, users] = await Promise.all([
    db.select().from(teams).where(eq(teams.institutionId, id)),
    db
      .select()
      .from(institutionMemberships)
      .where(eq(institutionMemberships.institutionId, id)),
    db.select().from(userRoles).where(eq(userRoles.institutionId, id)),
    db.select({ id: user.id, name: user.name, email: user.email, status: user.status }).from(user),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const coordinatorIds = new Set<string>();
  for (const m of memberships) coordinatorIds.add(m.userId);
  for (const r of roles) {
    if (r.role === "coordinator") coordinatorIds.add(r.userId);
  }

  const coordinators = [...coordinatorIds].map((userId) => {
    const u = userMap.get(userId);
    const membership = memberships.find((m) => m.userId === userId);
    return {
      id: userId,
      name: u?.name ?? "—",
      email: u?.email ?? "—",
      status: u?.status ?? "—",
      permission: membership?.permission ?? "coordinator",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/institutions" className="hover:text-foreground">
          Institutions
        </Link>
        <span>/</span>
        <span className="text-foreground">{institution.name}</span>
      </div>

      <PageHeader
        title={institution.name}
        description={`${institution.shortName} · ${institution.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <InstitutionForm institution={institution} />
            <LinkButton href="/admin/institutions" variant="outline" size="sm">
              Back
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={institution.status === "active" ? "default" : "secondary"}>
          {institution.status}
        </Badge>
        <Badge variant="outline">{teamRows.length} teams</Badge>
        <Badge variant="outline">{coordinators.length} coordinators</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Coordinators</h2>
        <CoordinatorsTable rows={coordinators} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Teams</h2>
        <InstitutionTeamsTable
          rows={teamRows.map((t) => ({
            id: t.id,
            name: formatTeamDisplayName(t, institution),
            identifier: t.identifier,
            record: `${t.wins}–${t.losses}`,
            status: t.status,
          }))}
        />
      </section>
    </div>
  );
}
