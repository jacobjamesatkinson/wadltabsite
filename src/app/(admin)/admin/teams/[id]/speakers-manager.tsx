"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addSpeaker, removeSpeaker } from "@/app/actions/teams";
import { DeleteButton } from "@/components/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SpeakersManager({
  teamId,
  speakers,
}: {
  teamId: string;
  speakers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await addSpeaker(teamId, name);
              toast.success("Speaker added");
              setName("");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="speaker-name">Add speaker</Label>
          <Input
            id="speaker-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          Add
        </Button>
      </form>

      {speakers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No speakers listed</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {speakers.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>{s.name}</span>
              <DeleteButton
                label="Remove"
                confirmTitle={`Remove ${s.name}?`}
                confirmDescription="They will be removed from this team."
                onDelete={async () => {
                  await removeSpeaker(s.id);
                  router.refresh();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
