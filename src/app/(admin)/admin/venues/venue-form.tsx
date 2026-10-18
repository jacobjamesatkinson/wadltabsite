"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVenue, updateVenue } from "@/app/actions/venues";
import { ROSTER_DAYS } from "@/db/schema";
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
  venue?: {
    id: string;
    name: string;
    address: string | null;
    status: string;
    rosterDay: string | null;
  };
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [rosterDay, setRosterDay] = useState(venue?.rosterDay ?? "");
  const editing = Boolean(venue);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && venue) {
          setName(venue.name);
          setAddress(venue.address ?? "");
          setRosterDay(venue.rosterDay ?? "");
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
                await updateVenue(venue.id, {
                  name,
                  address,
                  status: venue.status,
                  rosterDay: rosterDay || null,
                });
                toast.success("Venue updated");
              } else {
                await createVenue({
                  name,
                  address,
                  rosterDay: rosterDay || null,
                });
                toast.success("Venue created");
                setName("");
                setAddress("");
                setRosterDay("");
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
          <div className="space-y-1">
            <Label>Roster day</Label>
            <select
              className="flex h-9 w-full rounded-lg border px-2 text-sm"
              value={rosterDay}
              onChange={(e) => setRosterDay(e.target.value)}
            >
              <option value="">Unassigned</option>
              {ROSTER_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Two-week roster relative to each round&apos;s Monday start — e.g.
              Tuesday A is the day after that Monday; Tuesday B is a week later.
            </p>
          </div>
          <Button type="submit">{editing ? "Save" : "Create"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
