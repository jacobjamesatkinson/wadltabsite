import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  competitionTimeslots,
  institutionMemberships,
  teams,
  user,
  userRoles,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import { ensureSiteCompetition } from "@/lib/competition";
import {
  compareTeamNames,
  formatTeamDisplayName,
} from "@/lib/teams/display-name";
import { TeamForm } from "../../teams/team-form";
import { InstitutionForm } from "../institution-form";
import { CoordinatorsTable } from "./coordinators-table";
import { InstitutionCoordinatorForm } from "./institution-coordinator-form";
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

  const competition = await ensureSiteCompetition();

  const [teamRows, memberships, roles, users, divisions, venues, timeslots] =
    await Promise.all([
      db.select().from(teams).where(eq(teams.institutionId, id)),
      db
        .select()
        .from(institutionMemberships)
        .where(eq(institutionMemberships.institutionId, id)),
      db.select().from(userRoles).where(eq(userRoles.institutionId, id)),
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
        })
        .from(user),
      db.query.divisions.findMany({
        where: (t, { eq: e }) => e(t.competitionId, competition.id),
      }),
      db.query.venues.findMany(),
      db
        .select()
        .from(competitionTimeslots)
        .where(eq(competitionTimeslots.competitionId, competition.id)),
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

  const availableUsers = users
    .filter((u) => !coordinatorIds.has(u.id) && u.status === "active")
    .map((u) => ({ id: u.id, name: u.name, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const institutionOpt = {
    id: institution.id,
    name: institution.name,
    shortName: institution.shortName,
  };
  const divisionById = new Map(divisions.map((d) => [d.id, d]));

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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Coordinators</h2>
          <InstitutionCoordinatorForm
            institutionId={institution.id}
            availableUsers={availableUsers}
          />
        </div>
        <CoordinatorsTable rows={coordinators} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Teams</h2>
          <TeamForm
            competitionId={competition.id}
            institutions={[institutionOpt]}
            defaultInstitutionId={institution.id}
            lockInstitution
            triggerSize="sm"
            divisions={[...divisions]
              .sort(
                (a, b) =>
                  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
              )
              .map((d) => ({ id: d.id, name: d.name }))}
            venues={venues.map((v) => ({ id: v.id, name: v.name }))}
            timeslots={[...timeslots]
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((t) => ({
                id: t.id,
                startsAt: t.startsAt,
              }))}
          />
        </div>
        <InstitutionTeamsTable
          rows={teamRows
            .map((t) => {
              const div = t.divisionId
                ? divisionById.get(t.divisionId)
                : undefined;
              return {
                id: t.id,
                name: formatTeamDisplayName(t, institution),
                division: div?.name ?? "—",
                divisionSort: div?.sortOrder ?? 999,
                divisionChipColor: div?.chipColor ?? null,
                identifier: t.identifier,
                record: `${t.wins}–${t.losses}`,
                status: t.status,
              };
            })
            .sort((a, b) => compareTeamNames(a.name, b.name))}
        />
      </section>
    </div>
  );
}
