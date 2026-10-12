"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { studentAddSpeaker, studentRemoveSpeaker } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StudentSpeakerForm({
  token,
  speakerId,
  mode,
}: {
  token: string;
  speakerId?: string;
  mode: "add" | "remove";
}) {
  const router = useRouter();
  const [name, setName] = useState("");

  if (mode === "remove" && speakerId) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          if (!confirm("Remove this speaker?")) return;
          try {
            await studentRemoveSpeaker(token, speakerId);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }}
      >
        Remove
      </Button>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!confirm(`Add speaker “${name}”?`)) return;
        try {
          await studentAddSpeaker(token, name);
          setName("");
          toast.success("Speaker added");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <Input
        placeholder="Speaker name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Button type="submit" size="sm">
        Add speaker
      </Button>
    </form>
  );
}
