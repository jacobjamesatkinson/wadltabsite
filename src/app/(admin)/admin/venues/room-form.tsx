"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom } from "@/app/actions/venues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RoomForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createRoom({ venueId, identifier });
          setIdentifier("");
          toast.success("Room added");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <Input
        placeholder="Room ID"
        className="h-8 w-28"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
      />
      <Button size="sm" type="submit">
        Add room
      </Button>
    </form>
  );
}
