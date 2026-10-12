"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeam } from "@/app/actions/teams";
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

export function TeamForm({
  competitions,
  institutions,
  divisions,
}: {
  competitions: Array<{ id: string; name: string }>;
  institutions: Array<{ id: string; name: string }>;
  divisions: Array<{ id: string; name: string; competitionId: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "");
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");
  const [divisionId, setDivisionId] = useState("");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredDivisions = useMemo(
    () => divisions.filter((d) => d.competitionId === competitionId),
    [divisions, competitionId]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add team</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await createTeam({
                competitionId,
                institutionId,
                divisionId: divisionId || null,
                name,
                identifier,
              });
              toast.success("Team created");
              setOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label>Competition</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Institution</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Division</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
            >
              <option value="">—</option>
              {filteredDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Identifier</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
