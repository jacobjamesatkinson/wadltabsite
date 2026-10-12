import { inArray, or, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { debates, rounds, teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";

export default async function CoordinatorDrawPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const teamRows =
    ids.length > 0
      ? await db.select().from(teams).where(inArray(teams.institutionId, ids))
      : [];
  const teamIds = teamRows.map((t) => t.id);
  const publishedRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = publishedRounds.map((r) => r.id);

  const debateRows =
    teamIds.length > 0 && publishedIds.length > 0
      ? await db
          .select()
          .from(debates)
          .where(
            and(
              inArray(debates.roundId, publishedIds),
              or(
                inArray(debates.affirmativeTeamId, teamIds),
                inArray(debates.negativeTeamId, teamIds)
              )
            )
          )
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution draw"
        description="Published debates for your teams only"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affirmative</TableHead>
              <TableHead>Negative</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debateRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No published debates for your teams
                </TableCell>
              </TableRow>
            ) : (
              debateRows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.affirmativeTeamName}</TableCell>
                  <TableCell>{d.negativeTeamName}</TableCell>
                  <TableCell>{d.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
