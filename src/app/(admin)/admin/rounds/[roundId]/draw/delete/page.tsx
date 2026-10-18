import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adjudicatorAssignments, ballots, byes, debates } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RoundStepNav } from "../../round-step-nav";
import { DeleteDrawForm } from "./delete-draw-form";

export default async function DeleteDrawPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();
  if (round.drawStatus === "none") redirect(`/admin/rounds/${roundId}/draw`);

  const debateRows = await db.select({ id: debates.id }).from(debates).where(eq(debates.roundId, roundId));
  const debateIds = debateRows.map((d) => d.id);
  const [byeRows, assignmentRows, ballotRows] = await Promise.all([
    db.select({ id: byes.id }).from(byes).where(eq(byes.roundId, roundId)),
    debateIds.length
      ? db.select({ id: adjudicatorAssignments.id }).from(adjudicatorAssignments).where(inArray(adjudicatorAssignments.debateId, debateIds))
      : Promise.resolve([]),
    debateIds.length
      ? db.select({ id: ballots.id }).from(ballots).where(inArray(ballots.debateId, debateIds))
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="draw" />
      <PageHeader
        title="Delete draw"
        description="This removes the draw so you can create a new one. It cannot be undone."
        actions={
          <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/draw`} />}>
            Cancel
          </Button>
        }
      />
      <DeleteDrawForm
        roundId={roundId}
        roundName={round.name}
        isReleased={round.drawStatus === "published"}
        counts={{
          debates: debateRows.length,
          byes: byeRows.length,
          allocations: assignmentRows.length,
          ballots: ballotRows.length,
        }}
      />
    </div>
  );
}
