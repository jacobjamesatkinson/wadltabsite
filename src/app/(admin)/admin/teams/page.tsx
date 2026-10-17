import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { getSiteCompetition } from "@/lib/competition";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { TeamForm } from "./team-form";
import { TeamsTable } from "./teams-table";

export default async function TeamsPage() {
  const [teamRows, institutions, competition, divisions, speakers] =
    await Promise.all([
      db.query.teams.findMany(),
      db.query.institutions.findMany(),
      getSiteCompetition(),
      db.query.divisions.findMany(),
      db.query.speakers.findMany(),
    ]);

  const competitions = competition
    ? [{ id: competition.id, name: competition.name }]
    : [];
  const instMap = new Map(institutions.map((i) => [i.id, i]));
  const speakerCount = new Map<string, number>();
  for (const s of speakers) {
    speakerCount.set(s.teamId, (speakerCount.get(s.teamId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Competition teams — open a team for debates, ballots and private links"
        actions={
          <TeamForm
            competitions={competitions}
            institutions={institutions.map((i) => ({
              id: i.id,
              name: i.name,
              shortName: i.shortName,
            }))}
            divisions={divisions.map((d) => ({
              id: d.id,
              name: d.name,
              competitionId: d.competitionId,
            }))}
          />
        }
      />
      <TeamsTable
        rows={teamRows.map((t) => {
          const inst = t.institutionId ? instMap.get(t.institutionId) : null;
          return {
            id: t.id,
            name: formatTeamDisplayName(t, inst),
            identifier: t.identifier,
            institution: inst?.shortName ?? "—",
            record: `${t.wins}–${t.losses}`,
            speakers: speakerCount.get(t.id) ?? 0,
            status: t.status,
          };
        })}
      />
    </div>
  );
}
