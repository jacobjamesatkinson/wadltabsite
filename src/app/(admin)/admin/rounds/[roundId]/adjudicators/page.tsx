import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { loadAllocationData } from "@/lib/adjudicators/load";
import { cn } from "@/lib/utils";
import { RoundStepNav } from "../round-step-nav";
import { AllocationGrid } from "./allocation-grid";

export default async function RoundAdjudicatorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ venue?: string }>;
}) {
  const { roundId } = await params;
  const { venue: venueParam } = await searchParams;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();
  if (round.drawStatus === "none") redirect(`/admin/rounds/${roundId}/draw`);

  const data = await loadAllocationData(roundId);
  const venue = data.venues.find((v) => v.id === venueParam) ?? data.venues[0] ?? null;

  const allocated = data.venues.reduce(
    (sum, v) => sum + v.cells.filter((c) => c.assignments.length > 0).length,
    0
  );
  const total = data.venues.reduce((sum, v) => sum + v.cells.length, 0);

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="adjudicators" />
      <PageHeader
        title="Allocations"
        description={`${round.name} · ${total} room${total === 1 ? "" : "s"} · ${allocated} allocated · ${data.adjudicators.length} adjudicators`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/matchups`} />}>
              Back to matchups
            </Button>
            <Button render={<Link href={`/admin/rounds/${roundId}/display`} />}>
              Next: Display
            </Button>
          </>
        }
      />

      {data.venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no debates to allocate yet.{" "}
          <Link href={`/admin/rounds/${roundId}/draw`} className="underline underline-offset-2">
            Create the draw first.
          </Link>
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1 border-b" aria-label="Venues">
            {data.venues.map((v) => {
              const done = v.cells.filter((c) => c.assignments.length > 0).length;
              const active = v.id === venue?.id;
              return (
                <Link
                  key={v.id}
                  href={`/admin/rounds/${roundId}/adjudicators?venue=${v.id}`}
                  className={cn(
                    "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
                    active
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v.name}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      done === v.cells.length ? "text-emerald-700" : "text-muted-foreground"
                    )}
                  >
                    {done}/{v.cells.length}
                  </span>
                </Link>
              );
            })}
          </nav>
          {venue ? <AllocationGrid data={data} venueId={venue.id} /> : null}
        </>
      )}
    </div>
  );
}
