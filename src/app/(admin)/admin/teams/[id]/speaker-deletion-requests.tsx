"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveSpeakerDeletion,
  rejectSpeakerDeletion,
} from "@/app/actions/teams";
import { Button } from "@/components/ui/button";

export function SpeakerDeletionRequests({
  requests,
}: {
  requests: Array<{ id: string; speakerName: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-sm font-medium">Pending speaker removals</p>
      <p className="text-xs text-muted-foreground">
        These speakers appear on a ballot, so the team requested admin approval
        to remove them.
      </p>
      <ul className="divide-y rounded-md border bg-background">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span>{r.speakerName}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await rejectSpeakerDeletion(r.id);
                      toast.success("Removal request rejected");
                      router.refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  });
                }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await approveSpeakerDeletion(r.id);
                      toast.success("Speaker removed");
                      router.refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  });
                }}
              >
                Approve removal
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
