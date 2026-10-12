"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptBallot, disputeBallot } from "@/app/actions/ballots";
import { Button } from "@/components/ui/button";

export function BallotReviewActions({ ballotId }: { ballotId: string }) {
  const router = useRouter();

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        onClick={async () => {
          try {
            const res = await acceptBallot(ballotId);
            toast.success("Ballot accepted");
            if (res.laterDrawWarning) toast.message(res.laterDrawWarning);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await disputeBallot(ballotId, "Flagged for review");
            toast.message("Ballot disputed");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }}
      >
        Dispute
      </Button>
    </div>
  );
}
