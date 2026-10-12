"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestPostponement } from "@/app/actions/postponements";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PostponementForm({
  debates,
}: {
  debates: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [debateId, setDebateId] = useState(debates[0]?.id ?? "");
  const [reason, setReason] = useState("");

  if (debates.length === 0) {
    return <p className="text-sm text-muted-foreground">No eligible debates.</p>;
  }

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await requestPostponement(debateId, reason);
          toast.success("Request submitted");
          setReason("");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <select
        className="flex h-8 w-full rounded-lg border px-2 text-sm"
        value={debateId}
        onChange={(e) => setDebateId(e.target.value)}
      >
        {debates.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <Textarea
        placeholder="Reason for postponement"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />
      <Button type="submit">Submit request</Button>
    </form>
  );
}
