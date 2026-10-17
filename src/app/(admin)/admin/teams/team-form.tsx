"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeam, updateTeam } from "@/app/actions/teams";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
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

type TeamFormProps = {
  competitions: Array<{ id: string; name: string }>;
  institutions: Array<{ id: string; name: string; shortName: string }>;
  divisions: Array<{ id: string; name: string; competitionId: string }>;
  team?: {
    id: string;
    competitionId: string;
    institutionId: string | null;
    divisionId: string | null;
    name: string;
    identifier: string;
    status: string;
  };
};

export function TeamForm({ competitions, institutions, divisions, team }: TeamFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [competitionId, setCompetitionId] = useState(
    team?.competitionId ?? competitions[0]?.id ?? ""
  );
  const [institutionId, setInstitutionId] = useState(team?.institutionId ?? "");
  const [divisionId, setDivisionId] = useState(team?.divisionId ?? "");
  const [name, setName] = useState(team?.name ?? "");
  const [identifier, setIdentifier] = useState(team?.identifier ?? "");
  const [status, setStatus] = useState(team?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const editing = Boolean(team);

  const filteredDivisions = useMemo(
    () => divisions.filter((d) => d.competitionId === competitionId),
    [divisions, competitionId]
  );

  const selectedInstitution = institutions.find((i) => i.id === institutionId);
  const bound = Boolean(institutionId);
  const preview = formatTeamDisplayName(
    { name: name || "?", institutionId: institutionId || null },
    selectedInstitution
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && team) {
          setCompetitionId(team.competitionId);
          setInstitutionId(team.institutionId ?? "");
          setDivisionId(team.divisionId ?? "");
          setName(team.name);
          setIdentifier(team.identifier);
          setStatus(team.status);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size={editing ? "sm" : "default"} variant={editing ? "outline" : "default"} />
        }
      >
        {editing ? "Edit" : "Add team"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit team" : "Add team"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const payload = {
                competitionId,
                institutionId: institutionId || null,
                divisionId: divisionId || null,
                name,
                identifier: bound ? undefined : identifier,
                status: editing ? status : undefined,
              };
              if (team) {
                await updateTeam(team.id, payload);
                toast.success("Team updated");
              } else {
                await createTeam(payload);
                toast.success("Team created");
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
          {competitions.length > 1 ? (
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
          ) : null}
          <div className="space-y-1">
            <Label>Institution</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              <option value="">None (independent team)</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.shortName})
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
          {bound ? (
            <div className="space-y-1">
              <Label>Team number</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="1"
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown as <span className="font-medium text-foreground">{preview}</span> in
                draws
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Identifier</Label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          {editing ? (
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-lg border px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">active</option>
                <option value="withdrawn">withdrawn</option>
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
