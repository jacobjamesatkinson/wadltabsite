import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { getSiteCompetition } from "@/lib/competition";
import { DivisionsManager } from "./divisions-manager";

export default async function ManageDivisionsPage() {
  const competition = await getSiteCompetition();
  if (!competition) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Manage Divisions"
          description="No competition configured"
        />
      </div>
    );
  }

  const [divisionRows, teamRows] = await Promise.all([
    db.query.divisions.findMany({
      where: (t, { eq: e }) => e(t.competitionId, competition.id),
    }),
    db.query.teams.findMany({
      where: (t, { eq: e }) => e(t.competitionId, competition.id),
    }),
  ]);

  const teamCount = new Map<string, number>();
  for (const t of teamRows) {
    if (!t.divisionId) continue;
    teamCount.set(t.divisionId, (teamCount.get(t.divisionId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Divisions"
        description={`Add or delete divisions for ${competition.name}`}
      />
      <DivisionsManager
        competitionId={competition.id}
        divisions={divisionRows.map((d) => ({
          id: d.id,
          name: d.name,
          teamCount: teamCount.get(d.id) ?? 0,
        }))}
      />
    </div>
  );
}
