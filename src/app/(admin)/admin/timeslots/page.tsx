import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { competitionTimeslots } from "@/db/schema";
import { ensureSiteCompetition } from "@/lib/competition";
import { TimeslotsManager } from "./timeslots-manager";

export default async function TimeslotsPage() {
  const competition = await ensureSiteCompetition();

  const [slotRows, teamRows] = await Promise.all([
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id)),
    db.query.teams.findMany({
      where: (t, { eq: e }) => e(t.competitionId, competition.id),
    }),
  ]);

  const teamCount = new Map<string, number>();
  for (const t of teamRows) {
    if (!t.timeslotId) continue;
    teamCount.set(t.timeslotId, (teamCount.get(t.timeslotId) ?? 0) + 1);
  }

  const timeslots = [...slotRows]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      teamCount: teamCount.get(s.id) ?? 0,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeslots"
        description={`Debate start times for ${competition.name} — assigned to teams and used on public draws`}
      />
      <TimeslotsManager competitionId={competition.id} timeslots={timeslots} />
    </div>
  );
}
