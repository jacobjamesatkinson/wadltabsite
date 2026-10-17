"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitBallot } from "@/app/actions/ballots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddBallotDialog({
  debates,
}: {
  debates: {
    id: string;
    label: string;
    affirmativeTeamId: string | null;
    negativeTeamId: string | null;
  }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [debateId, setDebateId] = useState(debates[0]?.id ?? "");
  const debate = debates.find((d) => d.id === debateId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!debate) return;
    const formData = new FormData(e.currentTarget);
    const aff = Number(formData.get("aff"));
    const neg = Number(formData.get("neg"));
    const winner =
      aff >= neg ? debate.affirmativeTeamId : debate.negativeTeamId;
    if (!winner) {
      toast.error("Debate is missing teams");
      return;
    }
    startTransition(async () => {
      try {
        await submitBallot({
          debateId,
          winnerTeamId: winner,
          affirmativePoints: aff,
          negativePoints: neg,
        });
        toast.success("Ballot submitted");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add ballot</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ballot</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="debate">Debate</Label>
            <select
              id="debate"
              className="flex h-9 w-full border bg-transparent px-3 text-sm"
              value={debateId}
              onChange={(e) => setDebateId(e.target.value)}
            >
              {debates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="aff">Aff points</Label>
              <Input id="aff" name="aff" type="number" defaultValue={75} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neg">Neg points</Label>
              <Input id="neg" name="neg" type="number" defaultValue={74} required />
            </div>
          </div>
          <Button type="submit" disabled={pending || !debateId} className="w-full">
            {pending ? "Saving…" : "Submit ballot"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
