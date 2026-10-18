import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { BallotForm } from "@/components/ballots/ballot-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";
import { loadBallotDebate } from "@/lib/ballots/load";
import { hasPermission } from "@/lib/permissions";

export default async function AdjudicatorBallotPage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const { debateId } = await params;
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  const debate = await loadBallotDebate(debateId);
  if (!debate) notFound();

  const canReview = hasPermission(ctx, "ballots:review") || hasPermission(ctx, "results:manage");
  const allocated = profile ? debate.adjudicators.some((a) => a.id === profile.id) : false;
  if (!allocated && !canReview) notFound();

  const returnTo = "/adjudicator/ballots";
  const locked = debate.current?.status === "accepted" && !canReview;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${debate.affirmative?.name ?? "—"} v ${debate.negative?.name ?? "—"}`}
        description={`${debate.roundName} · ${debate.venue} · ${debate.timeslot} · Room ${debate.room}`}
        actions={
          <Button variant="outline" render={<Link href={returnTo} />}>
            Back
          </Button>
        }
      />
      {!debate.affirmative || !debate.negative ? (
        <p className="text-sm text-destructive">This debate is missing a team. Ask the tab team to fix the matchup.</p>
      ) : locked ? (
        <p className="text-sm text-muted-foreground">
          This result has been confirmed ({debate.current?.affTotal}–{debate.current?.negTotal}). Contact the tab team if
          it needs changing.
        </p>
      ) : (
        <BallotForm
          debateId={debate.id}
          affirmative={debate.affirmative}
          negative={debate.negative}
          scores={debate.scores}
          existing={debate.current}
          canConfirm={canReview}
          returnTo={returnTo}
        />
      )}
    </div>
  );
}
