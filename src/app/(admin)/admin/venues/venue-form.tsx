"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVenue, updateVenue } from "@/app/actions/venues";
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

export function VenueForm({
  venue,
}: {
  venue?: { id: string; name: string; address: string | null; status: string };
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const editing = Boolean(venue);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && venue) {
          setName(venue.name);
          setAddress(venue.address ?? "");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size={editing ? "sm" : "default"} variant={editing ? "outline" : "default"} />
        }
      >
        {editing ? "Edit" : "Add venue"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit venue" : "Add venue"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (venue) {
                await updateVenue(venue.id, { name, address, status: venue.status });
                toast.success("Venue updated");
              } else {
                await createVenue({ name, address });
                toast.success("Venue created");
                setName("");
                setAddress("");
              }
              setOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button type="submit">{editing ? "Save" : "Create"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
