import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { loadRoundAvailability } from "@/app/actions/availability";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RoundStepNav } from "../round-step-nav";
import { AvailabilityPanel } from "./availability-panel";

export default async function RoundAvailabilityPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();

  const availability = await loadRoundAvailability(roundId);

  return (
    <div className="space-y-6">
      <RoundStepNav
        roundId={roundId}
        roundName={round.name}
        current="availability"
      />
      <PageHeader
        title="Availability"
        description="Select who and which rooms are available for this round. Unavailable teams are ignored when generating the draw."
        actions={
          <Button render={<Link href={`/admin/rounds/${roundId}/draw`} />}>
            Next: Generate draw
          </Button>
        }
      />
      <AvailabilityPanel
        roundId={roundId}
        teams={availability.teams}
        adjudicators={availability.adjudicators}
        rooms={availability.rooms}
      />
    </div>
  );
}
