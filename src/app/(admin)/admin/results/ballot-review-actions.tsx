"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { confirmBallot, discardBallot } from "@/app/actions/ballots";
import { Button } from "@/components/ui/button";

/**
 * Tabbycat-style per-debate actions: Enter / Edit / Confirm / Discard.
 * `ballotId` is the live ballot (null = no ballot yet).
 */
export function BallotReviewActions({
  debateId,
  roundId,
  ballotId,
  status,
  editHref,
}: {
  debateId: string;
  roundId: string;
  ballotId: string | null;
  status: "none" | "unconfirmed" | "confirmed";
  editHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = editHref ?? `/admin/rounds/${roundId}/results/${debateId}/ballot`;

  const run = (label: string, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        const res = (await fn()) as { laterDrawWarning?: string | null } | void;
        toast.success(label);
        if (res && "laterDrawWarning" in res && res.laterDrawWarning) toast.message(res.laterDrawWarning);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });

  if (status === "none" || !ballotId) {
    return (
      <Button size="sm" render={<Link href={href} />}>
        Enter ballot
      </Button>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="outline" render={<Link href={href} />}>
        {status === "confirmed" ? "Re-enter" : "Edit"}
      </Button>
      {status === "unconfirmed" ? (
        <Button size="sm" disabled={pending} onClick={() => run("Ballot confirmed", () => confirmBallot(ballotId))}>
          Confirm
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(status === "confirmed" ? "Discard the confirmed result for this debate?" : "Discard this ballot?")) return;
          run("Ballot discarded", () => discardBallot(ballotId));
        }}
      >
        Discard
      </Button>
    </div>
  );
}
