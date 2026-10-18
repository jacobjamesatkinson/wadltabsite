import Link from "next/link";
import { notFound } from "next/navigation";
import { BallotForm } from "@/components/ballots/ballot-form";
import { BallotHistory } from "@/components/ballots/ballot-history";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";
import { loadBallotDebate } from "@/lib/ballots/load";
import { hasPermission } from "@/lib/permissions";
import { RoundStepNav } from "../../../round-step-nav";

export default async function AdminBallotPage({
  params,
}: {
  params: Promise<{ roundId: string; debateId: string }>;
}) {
  const { roundId, debateId } = await params;
  const ctx = await requireAuth();
  const debate = await loadBallotDebate(debateId);
  if (!debate || debate.roundId !== roundId) notFound();
  const canConfirm = hasPermission(ctx, "ballots:review") || hasPermission(ctx, "results:manage");
  const returnTo = `/admin/rounds/${roundId}/results`;

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={debate.roundName} current="results" />
      <PageHeader
        title={`${debate.affirmative?.name ?? "—"} v ${debate.negative?.name ?? "—"}`}
        description={`${debate.venue} · ${debate.timeslot} · Room ${debate.room}${debate.adjudicators.length ? ` · ${debate.adjudicators.map((a) => a.name).join(", ")}` : ""}`}
        actions={
          <Button variant="outline" render={<Link href={returnTo} />}>
            Back to results
          </Button>
        }
      />

      {!debate.affirmative || !debate.negative ? (
        <p className="text-sm text-destructive">
          This debate is missing a team.{" "}
          <Link href={`/admin/rounds/${roundId}/matchups`} className="underline underline-offset-2">
            Fix the matchup
          </Link>{" "}
          before entering a ballot.
        </p>
      ) : (
        <>
          {debate.current?.status === "accepted" ? (
            <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A confirmed ballot already exists (v{debate.current.version}). Saving a new ballot creates a new
              version; confirming it replaces the current result.
            </p>
          ) : null}
          <BallotForm
            debateId={debate.id}
            affirmative={debate.affirmative}
            negative={debate.negative}
            scores={debate.scores}
            existing={debate.current}
            canConfirm={canConfirm}
            returnTo={returnTo}
          />
          <BallotHistory debate={debate} />
        </>
      )}
    </div>
  );
}
