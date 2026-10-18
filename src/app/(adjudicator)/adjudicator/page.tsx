import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  ballots,
  competitionTimeslots,
  rooms,
  rounds,
  venues,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimeslotTime } from "@/lib/timeslots/format";

export default async function AdjudicatorTodayPage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });

  const assignments = profile
    ? await db
        .select()
        .from(adjudicatorAssignments)
        .where(eq(adjudicatorAssignments.adjudicatorId, profile.id))
    : [];
  const debateIds = assignments.map((a) => a.debateId);
  const debateRows =
    debateIds.length > 0
      ? await db.query.debates.findMany({
          where: (t, { inArray: inA }) => inA(t.id, debateIds),
        })
      : [];
  const roundIds = [...new Set(debateRows.map((d) => d.roundId))];
  const [roundRows, slots, roomRows, venueRows, ballotRows] = await Promise.all([
    roundIds.length
      ? db.select().from(rounds).where(inArray(rounds.id, roundIds))
      : Promise.resolve([]),
    db.select().from(competitionTimeslots),
    db.select().from(rooms),
    db.select().from(venues),
    debateIds.length
      ? db.select().from(ballots).where(inArray(ballots.debateId, debateIds))
      : Promise.resolve([]),
  ]);

  // Only released rounds are visible to adjudicators.
  const released = new Map(roundRows.filter((r) => r.drawStatus === "published").map((r) => [r.id, r]));
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v.name]));

  const visible = debateRows
    .filter((d) => released.has(d.roundId))
    .sort((a, b) => {
      const ra = released.get(a.roundId)!.number;
      const rb = released.get(b.roundId)!.number;
      if (ra !== rb) return rb - ra;
      const sa = a.timeslotId ? slotMap.get(a.timeslotId)?.sortOrder ?? 0 : 0;
      const sb = b.timeslotId ? slotMap.get(b.timeslotId)?.sortOrder ?? 0 : 0;
      return sa - sb;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My debates"
        description="Debates you are allocated to in released rounds, newest round first."
      />
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Affirmative</TableHead>
              <TableHead>Negative</TableHead>
              <TableHead>Ballot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No allocations yet
                </TableCell>
              </TableRow>
            ) : (
              visible.map((d) => {
                const slot = d.timeslotId ? slotMap.get(d.timeslotId) : null;
                const room = d.roomId ? roomMap.get(d.roomId) : null;
                const venueName = d.venueId ? venueMap.get(d.venueId) : room ? venueMap.get(room.venueId) : null;
                const debateBallots = ballotRows.filter((b) => b.debateId === d.id && !b.discarded);
                const confirmed = debateBallots.some((b) => b.status === "accepted");
                const submitted = debateBallots.some((b) => b.status === "submitted");
                return (
                  <TableRow key={d.id}>
                    <TableCell>{released.get(d.roundId)?.name}</TableCell>
                    <TableCell>{venueName ?? "—"}</TableCell>
                    <TableCell>{slot ? formatTimeslotTime(slot.startsAt) : "—"}</TableCell>
                    <TableCell>{room?.identifier ?? "—"}</TableCell>
                    <TableCell>{d.affirmativeTeamName ?? "—"}</TableCell>
                    <TableCell>{d.negativeTeamName ?? "—"}</TableCell>
                    <TableCell>
                      {confirmed ? (
                        <Badge variant="secondary">Confirmed</Badge>
                      ) : submitted ? (
                        <Badge variant="outline">Awaiting confirmation</Badge>
                      ) : (
                        <Button size="sm" render={<Link href={`/adjudicator/ballots/${d.id}`} />}>
                          Enter ballot
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
