"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitBallot } from "@/app/actions/ballots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BallotSubmitForm({
  debateId,
  affirmativeTeamId,
  negativeTeamId,
  affirmativeName,
  negativeName,
}: {
  debateId: string;
  affirmativeTeamId: string;
  negativeTeamId: string;
  affirmativeName: string;
  negativeName: string;
}) {
  const router = useRouter();
  const [winnerTeamId, setWinnerTeamId] = useState(affirmativeTeamId);
  const [affPts, setAffPts] = useState(75);
  const [negPts, setNegPts] = useState(72);
  const [feedback, setFeedback] = useState("");

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await submitBallot({
            debateId,
            winnerTeamId,
            affirmativePoints: affPts,
            negativePoints: negPts,
            feedback,
          });
          toast.success(
            res.needsReview
              ? "Submitted — flagged for administrative review"
              : "Ballot submitted"
          );
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <h3 className="font-medium">
        {affirmativeName} vs {negativeName}
      </h3>
      <div className="space-y-1">
        <Label>Winner</Label>
        <select
          className="flex h-8 w-full rounded-lg border px-2 text-sm"
          value={winnerTeamId}
          onChange={(e) => setWinnerTeamId(e.target.value)}
        >
          <option value={affirmativeTeamId}>{affirmativeName}</option>
          <option value={negativeTeamId}>{negativeName}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Affirmative points</Label>
          <Input
            type="number"
            value={affPts}
            onChange={(e) => setAffPts(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>Negative points</Label>
          <Input
            type="number"
            value={negPts}
            onChange={(e) => setNegPts(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Feedback</Label>
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <Button type="submit">Submit ballot</Button>
    </form>
  );
}
