"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  studentAddSpeaker,
  studentRemoveOrRequestSpeakerDeletion,
} from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamPortalSpeaker } from "@/lib/team-portal/load";

export function SpeakersPanel({
  token,
  speakers,
  canEdit,
}: {
  token: string;
  speakers: TeamPortalSpeaker[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <div className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {speakers.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No speakers listed
            </li>
          ) : (
            speakers.map((s) => (
              <li key={s.id} className="px-3 py-2 text-sm">
                {s.name}
              </li>
            ))
          )}
        </ul>
        <p className="text-xs text-muted-foreground">
          Speaker editing is disabled for this link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          startTransition(async () => {
            try {
              await studentAddSpeaker(token, trimmed);
              setName("");
              toast.success("Speaker added");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="max-w-xs"
          required
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Adding…" : "Add speaker"}
        </Button>
      </form>

      <ul className="divide-y rounded-lg border">
        {speakers.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            No speakers listed yet
          </li>
        ) : (
          speakers.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <p>{s.name}</p>
                {s.deletionPending ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Deletion requested — waiting for admin approval
                  </p>
                ) : s.onBallot ? (
                  <p className="text-xs text-muted-foreground">
                    Appears on a ballot — removal needs admin approval
                  </p>
                ) : null}
              </div>
              {s.deletionPending ? (
                <span className="text-xs text-muted-foreground">Pending</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const result =
                          await studentRemoveOrRequestSpeakerDeletion(
                            token,
                            s.id
                          );
                        toast.success(
                          result.mode === "deleted"
                            ? "Speaker removed"
                            : "Deletion requested — an admin must approve"
                        );
                        router.refresh();
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed"
                        );
                      }
                    });
                  }}
                >
                  {s.onBallot ? "Request removal" : "Remove"}
                </Button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
