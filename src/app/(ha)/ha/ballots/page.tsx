import { db } from "@/db";
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
import { BallotReviewActions } from "@/app/(admin)/admin/results/ballot-review-actions";

export default async function HaBallotsPage() {
  const ballots = await db.query.ballots.findMany();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ballots"
        description="Review and accept ballot submissions in your scope"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Debate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ballots.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.debateId}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{b.status}</Badge>
                </TableCell>
                <TableCell>{b.needsReview ? "Needs review" : "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {b.affirmativePoints}–{b.negativePoints}
                </TableCell>
                <TableCell className="text-right">
                  {b.status === "submitted" || b.status === "disputed" ? (
                    <BallotReviewActions ballotId={b.id} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
