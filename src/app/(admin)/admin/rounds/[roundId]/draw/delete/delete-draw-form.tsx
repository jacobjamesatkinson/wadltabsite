"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDraw } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteDrawForm({
  roundId,
  roundName,
  isReleased,
  counts,
}: {
  roundId: string;
  roundName: string;
  isReleased: boolean;
  counts: { debates: number; byes: number; allocations: number; ballots: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const needsTyping = isReleased || counts.ballots > 0;
  const canDelete = !needsTyping || confirm.trim().toLowerCase() === "delete";

  return (
    <div className="max-w-xl space-y-5 border border-destructive/40 p-5">
      <div className="space-y-1">
        <h2 className="font-medium">What will be deleted for {roundName}</h2>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          <li>{counts.debates} debate{counts.debates === 1 ? "" : "s"} (all matchups, sides and rooms)</li>
          <li>{counts.byes} bye{counts.byes === 1 ? "" : "s"}</li>
          <li>{counts.allocations} adjudicator allocation{counts.allocations === 1 ? "" : "s"}</li>
          <li className={counts.ballots > 0 ? "font-medium text-destructive" : ""}>
            {counts.ballots} ballot{counts.ballots === 1 ? "" : "s"}
            {counts.ballots > 0 ? " — results for this round will be lost and team standings recalculated" : ""}
          </li>
        </ul>
      </div>

      {isReleased ? (
        <p className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This draw is released. Deleting it removes it from the public draw, coordinator and
          adjudicator views immediately.
        </p>
      ) : null}

      {needsTyping ? (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">
            Type <span className="font-mono">delete</span> to confirm
          </Label>
          <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
      ) : null}

      <Button
        variant="destructive"
        disabled={pending || !canDelete}
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteDraw(roundId);
              toast.success("Draw deleted");
              router.push(`/admin/rounds/${roundId}/draw`);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to delete draw");
            }
          })
        }
      >
        {pending ? "Deleting…" : "Delete draw"}
      </Button>
    </div>
  );
}
