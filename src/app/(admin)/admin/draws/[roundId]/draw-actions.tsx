"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generateRoundDraw,
  publishRoundDraw,
  revisePublishedDraw,
} from "@/app/actions/draws";
import { autoAllocateRound } from "@/app/actions/adjudicators";
import { Button } from "@/components/ui/button";

export function DrawActions({
  roundId,
  drawStatus,
  hasHard,
}: {
  roundId: string;
  drawStatus: string;
  hasHard: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(label);
    try {
      const result = await fn();
      toast.success(`${label} complete`);
      if (result && typeof result === "object" && "softWarnings" in result) {
        const r = result as { softWarnings: string[]; hardViolations: string[] };
        if (r.hardViolations.length) toast.error(`${r.hardViolations.length} hard violations`);
        else if (r.softWarnings.length) toast.message(`${r.softWarnings.length} warnings`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {drawStatus === "published" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => run("Revise", () => revisePublishedDraw(roundId))}
        >
          {loading === "Revise" ? "Working…" : "Revise published"}
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={!!loading}
          onClick={() => run("Generate", () => generateRoundDraw({ roundId }))}
        >
          {loading === "Generate" ? "Generating…" : "Generate draft"}
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={!!loading || drawStatus === "none" || hasHard}
        onClick={() => run("Publish", () => publishRoundDraw(roundId))}
      >
        {loading === "Publish" ? "Publishing…" : "Publish"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!!loading || drawStatus === "none"}
        onClick={() => run("Allocate", () => autoAllocateRound(roundId))}
      >
        {loading === "Allocate" ? "Allocating…" : "Auto-allocate adjudicators"}
      </Button>
    </div>
  );
}
