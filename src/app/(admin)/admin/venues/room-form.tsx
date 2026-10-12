"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom, updateRoom } from "@/app/actions/venues";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function RoomEditButton({
  room,
}: {
  room: { id: string; identifier: string; capacity: number | null; available: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState(room.identifier);
  const [capacity, setCapacity] = useState(room.capacity?.toString() ?? "");
  const [available, setAvailable] = useState(room.available);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setIdentifier(room.identifier);
          setCapacity(room.capacity?.toString() ?? "");
          setAvailable(room.available);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit room</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await updateRoom(room.id, {
                identifier,
                capacity: capacity ? Number(capacity) : null,
                available,
              });
              toast.success("Room updated");
              setOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1">
            <Label>Identifier</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Capacity</Label>
            <Input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available
          </label>
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
