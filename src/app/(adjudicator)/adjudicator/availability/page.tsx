import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adjudicatorAvailability, competitionTimeslots, rounds } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { ensureSiteCompetition } from "@/lib/competition";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { AvailabilityToggle } from "./availability-toggle";

export default async function AvailabilityPage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  if (!profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Availability" />
        <p className="text-sm text-muted-foreground">
          No adjudicator profile is linked to your account. Ask an administrator.
        </p>
      </div>
    );
  }

  const competition = await ensureSiteCompetition();
  const [roundRows, slots, avail] = await Promise.all([
    db.select().from(rounds).where(eq(rounds.competitionId, competition.id)).orderBy(asc(rounds.number)),
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id))
      .orderBy(asc(competitionTimeslots.sortOrder), asc(competitionTimeslots.startsAt)),
    db.select().from(adjudicatorAvailability).where(eq(adjudicatorAvailability.adjudicatorId, profile.id)),
  ]);
  const availMap = new Map(avail.map((a) => [`${a.roundId}|${a.timeslotId}`, a.available]));
  // Rounds that are still open for allocation (not yet released) come first.
  const upcoming = roundRows.filter((r) => r.drawStatus !== "published");
  const past = roundRows.filter((r) => r.drawStatus === "published");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Mark the timeslots you can adjudicate in each round. You are available unless you say otherwise."
      />
      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeslots have been set up yet.</p>
      ) : null}
      {[...upcoming, ...past].map((round) => (
        <section key={round.id} className="space-y-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold">
            {round.name}
            {round.drawStatus === "published" ? (
              <span className="text-xs font-normal text-muted-foreground">draw released</span>
            ) : null}
          </h2>
          <ul className="divide-y border">
            {slots.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <p className="font-medium">{formatTimeslotTime(s.startsAt)}</p>
                <AvailabilityToggle
                  roundId={round.id}
                  adjudicatorId={profile.id}
                  timeslotId={s.id}
                  available={availMap.get(`${round.id}|${s.id}`) ?? true}
                  disabled={round.drawStatus === "published"}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
