"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeam, updateTeam } from "@/app/actions/teams";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
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
  competitionId: string;
  institutions: Array<{ id: string; name: string; shortName: string }>;
  divisions: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
  timeslots: Array<{ id: string; startsAt: string }>;
  /** Pre-select institution when creating (ignored when editing). */
  defaultInstitutionId?: string;
  /** Hide the institution picker and keep the selected institution fixed. */
  lockInstitution?: boolean;
  triggerSize?: "default" | "sm";
  team?: {
    id: string;
    competitionId: string;
    institutionId: string | null;
    divisionId: string | null;
    venueId: string | null;
    timeslotId: string | null;
    name: string;
    identifier: string;
    status: string;
  };
};

export function TeamForm({
  competitionId,
  institutions,
  divisions,
  venues,
  timeslots,
  defaultInstitutionId,
  lockInstitution = false,
  triggerSize,
  team,
}: TeamFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initialInstitutionId =
    team?.institutionId ?? defaultInstitutionId ?? "";
  const [institutionId, setInstitutionId] = useState(initialInstitutionId);
  const [divisionId, setDivisionId] = useState(team?.divisionId ?? "");
  const [venueId, setVenueId] = useState(team?.venueId ?? "");
  const [timeslotId, setTimeslotId] = useState(team?.timeslotId ?? "");
  const [name, setName] = useState(team?.name ?? "");
  const [identifier, setIdentifier] = useState(team?.identifier ?? "");
  const [status, setStatus] = useState(team?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const editing = Boolean(team);
  const buttonSize = triggerSize ?? (editing ? "sm" : "default");

  const selectedInstitution = institutions.find((i) => i.id === institutionId);
  const bound = Boolean(institutionId);
  const preview = formatTeamDisplayName(
    { name: name || "?", institutionId: institutionId || null },
    selectedInstitution
  );
  const lockedDivisionName =
    divisions.find((d) => d.id === divisionId)?.name ?? "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) return;
        if (team) {
          setInstitutionId(team.institutionId ?? "");
          setDivisionId(team.divisionId ?? "");
          setVenueId(team.venueId ?? "");
          setTimeslotId(team.timeslotId ?? "");
          setName(team.name);
          setIdentifier(team.identifier);
          setStatus(team.status);
        } else {
          setInstitutionId(defaultInstitutionId ?? "");
          setDivisionId("");
          setVenueId("");
          setTimeslotId("");
          setName("");
          setIdentifier("");
          setStatus("active");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            size={buttonSize}
            variant={editing ? "outline" : "default"}
          />
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
                venueId: venueId || null,
                timeslotId: timeslotId || null,
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
          <div className="space-y-1">
            <Label>Institution</Label>
            {lockInstitution ? (
              <Input
                value={
                  selectedInstitution
                    ? `${selectedInstitution.name} (${selectedInstitution.shortName})`
                    : "—"
                }
                disabled
                readOnly
              />
            ) : (
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
            )}
          </div>
          <div className="space-y-1">
            <Label>Division</Label>
            {editing ? (
              <>
                <Input value={lockedDivisionName} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Division is set at creation and cannot change
                </p>
              </>
            ) : (
              <select
                className="flex h-8 w-full rounded-lg border px-2 text-sm"
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                required
              >
                <option value="">Select division…</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label>Venue</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Timeslot</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={timeslotId}
              onChange={(e) => setTimeslotId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {timeslots.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatTimeslotTime(t.startsAt)}
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
          <Button type="submit" disabled={loading || (!editing && !divisionId)}>
            {loading ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
