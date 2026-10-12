import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { debates, postponementRequests, teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { PostponementForm } from "./postponement-form";

export default async function PostponementsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const requests =
    ids.length > 0
      ? await db
          .select()
          .from(postponementRequests)
          .where(inArray(postponementRequests.institutionId, ids))
      : [];

  const teamRows =
    ids.length > 0
      ? await db.select().from(teams).where(inArray(teams.institutionId, ids))
      : [];
  const teamIds = teamRows.map((t) => t.id);
  const published = await db.query.rounds.findMany({
    where: (t, { eq }) => eq(t.drawStatus, "published"),
  });
  const publishedIds = published.map((r) => r.id);
  const eligibleDebates =
    teamIds.length && publishedIds.length
      ? await db
          .select()
          .from(debates)
          .where(inArray(debates.roundId, publishedIds))
      : [];
  const myDebates = eligibleDebates.filter(
    (d) =>
      (d.affirmativeTeamId && teamIds.includes(d.affirmativeTeamId)) ||
      (d.negativeTeamId && teamIds.includes(d.negativeTeamId))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Postponement requests"
        description="Requests are recorded for admin review and never auto-change the draw"
      />
      <PostponementForm
        debates={myDebates.map((d) => ({
          id: d.id,
          label: `${d.affirmativeTeamName} vs ${d.negativeTeamName}`,
        }))}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Debate</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.debateId}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
