"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  publishRoundDraw,
  revisePublishedDraw,
} from "@/app/actions/draws";
import { Button } from "@/components/ui/button";

export function DisplayActions({
  roundId,
  drawStatus,
  hasHard,
  hasDraft,
}: {
  roundId: string;
  drawStatus: string;
  hasHard: boolean;
  hasDraft: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(label);
    try {
      await fn();
      toast.success(`${label} complete`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 border p-5">
      {drawStatus === "published" ? (
        <>
          <p className="w-full text-sm text-muted-foreground">
            Draw is live on the public board. Revise to edit and re-release.
          </p>
          <Button
            variant="outline"
            disabled={!!loading}
            onClick={() => run("Revise", () => revisePublishedDraw(roundId))}
          >
            {loading === "Revise" ? "Working…" : "Revise published draw"}
          </Button>
        </>
      ) : (
        <>
          <p className="w-full text-sm text-muted-foreground">
            Publishing releases the current draft to the public draw and
            coordinator views.
          </p>
          <Button
            disabled={!!loading || hasHard || !hasDraft}
            onClick={() => run("Release", () => publishRoundDraw(roundId))}
          >
            {loading === "Release" ? "Releasing…" : "Release draw"}
          </Button>
        </>
      )}
    </div>
  );
}
