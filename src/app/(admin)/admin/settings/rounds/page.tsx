import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { getSiteCompetition } from "@/lib/competition";
import { RoundsManager } from "./rounds-manager";

export default async function ManageRoundsPage() {
  const competition = await getSiteCompetition();
  if (!competition) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manage Rounds" description="No competition configured" />
      </div>
    );
  }

  const scoped = await db.query.rounds.findMany({
    where: (t, { eq: e }) => e(t.competitionId, competition.id),
    orderBy: (t, { asc: a }) => [a(t.number)],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Rounds"
        description={`Add, edit or delete rounds for ${competition.name}`}
      />
      <RoundsManager
        competitionId={competition.id}
        rounds={scoped.map((r) => ({
          id: r.id,
          name: r.name,
          number: r.number,
          date: r.date ? r.date.toISOString().slice(0, 10) : "—",
          drawStatus: r.drawStatus,
        }))}
      />
    </div>
  );
}
