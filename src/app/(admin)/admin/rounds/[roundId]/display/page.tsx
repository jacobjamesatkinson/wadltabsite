import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { debates, drawVersions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const [debateRows, versions] = await Promise.all([
    db.select().from(debates).where(eq(debates.roundId, roundId)),
    db.select().from(drawVersions).where(eq(drawVersions.roundId, roundId)),
  ]);
  const latest = [...versions].sort((a, b) => b.version - a.version)[0];
  const hard = (latest?.hardViolations as string[] | undefined) ?? [];
  const isPublished = round.drawStatus === "published";

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="display" />
      <PageHeader
        title="Display"
        description="Release the draw to the public board and role dashboards."
        actions={
          <Button
            variant="outline"
            render={<Link href={`/admin/rounds/${roundId}/results`} />}
          >
            Next: Results
          </Button>
        }
      />

      <div className="grid gap-4 border p-5 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <Badge variant={isPublished ? "default" : "secondary"} className="mt-2">
            {round.drawStatus}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Debates
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {debateRows.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Public board
          </p>
          <Button
            className="mt-2"
            variant="outline"
            size="sm"
            render={<Link href="/public/draw" target="_blank" />}
          >
            Open public draw
          </Button>
        </div>
      </div>

      {hard.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Cannot release yet</AlertTitle>
          <AlertDescription>
            Resolve {hard.length} hard constraint violation(s) on the draw page
            before publishing.
          </AlertDescription>
        </Alert>
      ) : null}

      {!latest || latest.status === "superseded" ? (
        <Alert>
          <AlertTitle>No draft ready</AlertTitle>
          <AlertDescription>
            Generate a draft draw before releasing it for display.
          </AlertDescription>
        </Alert>
      ) : null}

      <DisplayActions
        roundId={roundId}
        drawStatus={round.drawStatus}
        hasHard={hard.length > 0}
        hasDraft={!!latest && latest.status === "draft"}
      />
    </div>
  );
}
