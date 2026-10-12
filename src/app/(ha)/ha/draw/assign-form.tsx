"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignAdjudicator } from "@/app/actions/adjudicators";
import { Button } from "@/components/ui/button";

export function AssignAdjForm({
  debateId,
  adjudicators,
}: {
  debateId: string;
  adjudicators: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  return (
    <form
      className="flex items-center justify-end gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const adjudicatorId = String(fd.get("adjudicatorId") ?? "");
        if (!adjudicatorId) return;
        try {
          await assignAdjudicator(debateId, adjudicatorId);
          toast.success("Assigned");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <select name="adjudicatorId" className="h-7 max-w-[120px] rounded border text-xs">
        {adjudicators.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button size="xs" type="submit">
        Add
      </Button>
    </form>
  );
}
