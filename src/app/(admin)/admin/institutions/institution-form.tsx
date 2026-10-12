"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInstitution, updateInstitution } from "@/app/actions/institutions";
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

export function InstitutionForm({
  institution,
}: {
  institution?: { id: string; name: string; shortName: string; status: string };
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(institution?.name ?? "");
  const [shortName, setShortName] = useState(institution?.shortName ?? "");
  const [status, setStatus] = useState(institution?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const editing = Boolean(institution);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && institution) {
          setName(institution.name);
          setShortName(institution.shortName);
          setStatus(institution.status);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size={editing ? "sm" : "default"} variant={editing ? "outline" : "default"} />
        }
      >
        {editing ? "Edit" : "Add institution"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit institution" : "Add institution"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              if (institution) {
                await updateInstitution(institution.id, { name, shortName, status });
                toast.success("Institution updated");
              } else {
                await createInstitution({ name, shortName });
                toast.success("Institution created");
                setName("");
                setShortName("");
              }
              setOpen(false);
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
          {editing ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-lg border px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
