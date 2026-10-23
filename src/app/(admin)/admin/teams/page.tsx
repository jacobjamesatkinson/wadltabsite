import { eq } from "drizzle-orm";
import { db } from "@/db";
import { competitionTimeslots } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { ensureSiteCompetition } from "@/lib/competition";
import {
  compareTeamNames,
  formatTeamDisplayName,
} from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { TeamForm } from "./team-form";
import { TeamsTable } from "./teams-table";

export default async function TeamsPage() {
  const competition = await ensureSiteCompetition();
  const [teamRows, institutions, divisions, speakers, venues, timeslots] =
    await Promise.all([
      db.query.teams.findMany({
        where: (t, { eq: e }) => e(t.competitionId, competition.id),
      }),
      db.query.institutions.findMany(),
      db.query.divisions.findMany({
        where: (t, { eq: e }) => e(t.competitionId, competition.id),
      }),
      db.query.speakers.findMany(),
      db.query.venues.findMany(),
      db
        .select()
        .from(competitionTimeslots)
        .where(eq(competitionTimeslots.competitionId, competition.id)),
    ]);

  const instMap = new Map(institutions.map((i) => [i.id, i]));
  const divMap = new Map(divisions.map((d) => [d.id, d]));
  const venueMap = new Map(venues.map((v) => [v.id, v]));
  const slotMap = new Map(timeslots.map((t) => [t.id, t]));
  const speakerCount = new Map<string, number>();
  for (const s of speakers) {
    speakerCount.set(s.teamId, (speakerCount.get(s.teamId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        actions={
          <TeamForm
            competitionId={competition.id}
            institutions={institutions.map((i) => ({
              id: i.id,
              name: i.name,
              shortName: i.shortName,
            }))}
            divisions={[...divisions]
              .sort(
                (a, b) =>
                  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
              )
              .map((d) => ({
                id: d.id,
                name: d.name,
              }))}
            venues={venues.map((v) => ({ id: v.id, name: v.name }))}
            timeslots={[...timeslots]
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((t) => ({
                id: t.id,
                startsAt: t.startsAt,
              }))}
          />
        }
      />
      <TeamsTable
        rows={teamRows
          .map((t) => {
            const inst = t.institutionId ? instMap.get(t.institutionId) : null;
            return {
              id: t.id,
              name: formatTeamDisplayName(t, inst),
              identifier: t.identifier,
              institution: inst?.shortName ?? "—",
              division: t.divisionId
                ? divMap.get(t.divisionId)?.name ?? "—"
                : "—",
              divisionSort: t.divisionId
                ? (divMap.get(t.divisionId)?.sortOrder ?? 999)
                : 999,
              divisionChipColor: t.divisionId
                ? (divMap.get(t.divisionId)?.chipColor ?? null)
                : null,
              venue: t.venueId ? venueMap.get(t.venueId)?.name ?? "—" : "—",
              timeslot: t.timeslotId
                ? formatTimeslotTime(
                    slotMap.get(t.timeslotId)?.startsAt ?? ""
                  ) || "—"
                : "—",
              record: `${t.wins}–${t.losses}`,
              speakers: speakerCount.get(t.id) ?? 0,
              status: t.status,
            };
          })
          .sort((a, b) => compareTeamNames(a.name, b.name))}
      />
    </div>
  );
}
