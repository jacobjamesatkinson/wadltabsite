"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCompetitionStatus } from "@/app/actions/competitions";
import { Button } from "@/components/ui/button";

const FLOW = ["draft", "open", "closed", "running", "complete", "archived"];

export function StatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const idx = FLOW.indexOf(status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const prev = idx > 0 ? FLOW[idx - 1] : null;

  async function setStatus(s: string) {
    try {
      await updateCompetitionStatus(id, s);
      toast.success(`Status → ${s}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex gap-2">
      {prev ? (
        <Button size="sm" variant="outline" onClick={() => setStatus(prev)}>
          Previous ({prev})
        </Button>
      ) : null}
      {next ? (
        <Button size="sm" onClick={() => setStatus(next)}>
          Next ({next})
        </Button>
      ) : null}
    </div>
  );
}
