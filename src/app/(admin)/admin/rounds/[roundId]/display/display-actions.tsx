"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { releaseDraw, unreleaseDraw } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";

export function DisplayActions({
  roundId,
  drawStatus,
  blockers,
}: {
  roundId: string;
  drawStatus: "none" | "draft" | "published";
  blockers: string[];
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

  if (drawStatus === "none") {
    return (
      <div className="flex flex-wrap items-center gap-3 border p-5">
        <p className="text-sm text-muted-foreground">There is no draw to release yet.</p>
        <Button render={<Link href={`/admin/rounds/${roundId}/draw`} />}>Create draw</Button>
      </div>
    );
  }

  if (drawStatus === "published") {
    return (
      <div className="flex flex-wrap items-center gap-3 border p-5">
        <p className="w-full text-sm text-muted-foreground">
          The draw is live on the public board and in coordinator and adjudicator dashboards.
          Unrelease to hide it while you make changes, or edit matchups and allocations directly.
        </p>
        <Button variant="outline" disabled={pending} onClick={() => run("Draw unreleased", () => unreleaseDraw(roundId))}>
          {pending ? "Working…" : "Unrelease draw"}
        </Button>
        <Button variant="destructive" render={<Link href={`/admin/rounds/${roundId}/draw/delete`} />}>
          Delete draw
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border p-5">
      <p className="text-sm text-muted-foreground">
        Releasing makes the draw visible to teams, coordinators and adjudicators.
      </p>
      {blockers.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-destructive">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <Button disabled={pending || blockers.length > 0} onClick={() => run("Draw released", () => releaseDraw(roundId))}>
        {pending ? "Releasing…" : "Release draw"}
      </Button>
    </div>
  );
}
