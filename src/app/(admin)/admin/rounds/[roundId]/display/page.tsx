import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadDrawView } from "@/lib/draw/view";
import { RoundStepNav } from "../round-step-nav";
import { DisplayActions } from "./display-actions";

export default async function RoundDisplayPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();

  const view = round.drawStatus === "none" ? null : await loadDrawView(roundId);
  const debates = view?.debates ?? [];
  const missingTeams = debates.filter((d) => !d.affirmative || !d.negative).length;
  const missingRooms = debates.filter((d) => !d.roomId).length;
  const missingAdjs = debates.filter((d) => d.adjudicators.length === 0).length;
  const isPublished = round.drawStatus === "published";

  const blockers: string[] = [];
  if (missingTeams > 0) blockers.push(`${missingTeams} room${missingTeams === 1 ? " is" : "s are"} missing a team`);

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="display" />
      <PageHeader
        title="Display"
        description="Release the draw to the public board and role dashboards."
        actions={
          <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/results`} />}>
            Next: Results
          </Button>
        }
      />

      <div className="grid gap-px border bg-border sm:grid-cols-5">
        <div className="bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <Badge variant={isPublished ? "default" : "secondary"} className="mt-2">
            {round.drawStatus === "none" ? "No draw" : isPublished ? "Released" : "Draft"}
          </Badge>
        </div>
        <div className="bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Debates</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{debates.length}</p>
        </div>
        <div className="bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Without room</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${missingRooms ? "text-amber-700" : ""}`}>{missingRooms}</p>
          {missingRooms ? (
            <Link href={`/admin/rounds/${roundId}/matchups`} className="text-xs underline underline-offset-2">Assign rooms</Link>
          ) : null}
        </div>
        <div className="bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Without adjudicator</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${missingAdjs ? "text-amber-700" : ""}`}>{missingAdjs}</p>
          {missingAdjs ? (
            <Link href={`/admin/rounds/${roundId}/adjudicators`} className="text-xs underline underline-offset-2">Allocate</Link>
          ) : null}
        </div>
        <div className="bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Public board</p>
          <Button className="mt-2" variant="outline" size="sm" render={<Link href="/public/draw" target="_blank" />}>
            Open public draw
          </Button>
        </div>
      </div>

      <DisplayActions roundId={roundId} drawStatus={round.drawStatus} blockers={blockers} />
    </div>
  );
}
