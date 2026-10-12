"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCompetition } from "@/app/actions/competitions";
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

export function CompetitionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [season, setSeason] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New competition</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create competition</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const { id } = await createCompetition({ name, shortName, season });
              toast.success("Competition created");
              setOpen(false);
              router.push(`/admin/competitions/${id}`);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="short">Short name</Label>
            <Input
              id="short"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="season">Season</Label>
            <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
