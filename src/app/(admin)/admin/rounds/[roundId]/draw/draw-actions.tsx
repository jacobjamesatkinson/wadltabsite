"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { releaseDraw, unreleaseDraw } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";

export function DrawActions({
  roundId,
  drawStatus,
  incompleteRooms,
}: {
  roundId: string;
  drawStatus: "draft" | "published";
  incompleteRooms: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (label: string, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/matchups`} />}>
        Edit matchups
      </Button>
      <Button variant="outline" render={<Link href={`/admin/rounds/${roundId}/adjudicators`} />}>
        Allocate adjudicators
      </Button>
      {drawStatus === "draft" ? (
        <Button
          disabled={pending || incompleteRooms > 0}
          title={incompleteRooms > 0 ? `${incompleteRooms} room(s) are missing a team` : undefined}
          onClick={() => run("Draw released", () => releaseDraw(roundId))}
        >
          {pending ? "Working…" : "Release draw"}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run("Draw unreleased", () => unreleaseDraw(roundId))}
        >
          {pending ? "Working…" : "Unrelease"}
        </Button>
      )}
      <Button variant="destructive" render={<Link href={`/admin/rounds/${roundId}/draw/delete`} />}>
        Delete draw
      </Button>
    </div>
  );
}
