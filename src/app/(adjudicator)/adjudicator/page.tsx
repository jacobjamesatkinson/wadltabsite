import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  timeslots,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          where: (t, { inArray }) => inArray(t.id, debateIds),
        })
      : [];
  const slots = await db.select().from(timeslots);
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  const sorted = [...debateRows].sort((a, b) => {
    const sa = a.timeslotId ? slotMap.get(a.timeslotId)?.startsAt?.getTime() ?? 0 : 0;
    const sb = b.timeslotId ? slotMap.get(b.timeslotId)?.startsAt?.getTime() ?? 0 : 0;
    return sa - sb;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description="Your assigned debates, ordered by timeslot"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timeslot</TableHead>
              <TableHead>Affirmative</TableHead>
              <TableHead>Negative</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No assignments yet
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((d) => {
                const assignment = assignments.find((a) => a.debateId === d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.timeslotId ? slotMap.get(d.timeslotId)?.label : "—"}
                    </TableCell>
                    <TableCell>{d.affirmativeTeamName}</TableCell>
                    <TableCell>{d.negativeTeamName}</TableCell>
                    <TableCell>{assignment?.role}</TableCell>
                    <TableCell>{d.status}</TableCell>
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
