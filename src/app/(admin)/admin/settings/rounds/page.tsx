import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { ensureSiteCompetition } from "@/lib/competition";
import { formatLocalDate } from "@/lib/roster/dates";
import { RoundsManager } from "./rounds-manager";

export default async function ManageRoundsPage() {
  const competition = await ensureSiteCompetition();

  const scoped = await db.query.rounds.findMany({
    where: (t, { eq: e }) => e(t.competitionId, competition.id),
    orderBy: (t, { asc: a }) => [a(t.number)],
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Manage Rounds" />
      <RoundsManager
        competitionId={competition.id}
        rounds={scoped.map((r) => ({
          id: r.id,
          name: r.name,
          number: r.number,
          date: r.date ? formatLocalDate(r.date) : "",
          drawStatus: r.drawStatus,
        }))}
      />
    </div>
  );
}
