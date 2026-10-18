import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { loadDrawView } from "@/lib/draw/view";
import { RoundStepNav } from "../round-step-nav";
import { MatchupsEditor } from "./matchups-editor";

export default async function MatchupsPage({
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

  const view = await loadDrawView(roundId);

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="matchups" />
      <PageHeader
        title="Edit matchups"
        description="Drag teams between rooms or from the tray. Teams can only be placed in rooms at their own venue, timeslot and division."
        actions={
          <>
            <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/draw`} />}>
              Back to draw
            </Button>
            <Button render={<Link href={`/admin/rounds/${roundId}/adjudicators`} />}>
              Next: Adjudicators
            </Button>
          </>
        }
      />
      {round.drawStatus === "published" ? (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This draw is released — changes here are visible to teams immediately.
        </p>
      ) : null}
      <MatchupsEditor view={view} />
    </div>
  );
}
