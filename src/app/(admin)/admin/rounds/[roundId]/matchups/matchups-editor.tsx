"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowLeftRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addDebate,
  giveBye,
  placeTeam,
  removeBye,
  removeDebate,
  setDebateRoom,
  swapSides,
  unplaceTeam,
} from "@/app/actions/draws";
import { DivisionChip } from "@/components/division-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DrawView, DrawViewDebate, DrawViewTeam } from "@/lib/draw/view";
import { cn } from "@/lib/utils";
import { DrawFlags } from "../draw/draw-flags";

type DragPayload = { teamId: string };

function compatible(team: DrawViewTeam, debate: DrawViewDebate) {
  return (
    (!debate.venueId || team.venueId === debate.venueId) &&
    (!debate.timeslotId || team.timeslotId === debate.timeslotId) &&
    (!debate.divisionId || team.divisionId === debate.divisionId)
  );
}

function TeamChip({
  team,
  onRemove,
  selected,
  onSelect,
  draggable = true,
  dense = false,
}: {
  team: DrawViewTeam;
  onRemove?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  draggable?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ teamId: team.id } satisfies DragPayload));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      className={cn(
        "group flex min-w-0 cursor-grab items-center gap-1.5 border bg-background px-2 text-sm active:cursor-grabbing",
        dense ? "h-8" : "h-9",
        selected && "border-foreground ring-2 ring-foreground/20",
        onSelect && "cursor-pointer"
      )}
      title={team.institutionName ?? undefined}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{team.name}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {team.wins}–{team.losses}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label={`Remove ${team.name}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function Slot({
  team,
  side,
  debate,
  active,
  eligible,
  onDrop,
  onRemove,
  onClickEmpty,
}: {
  team: DrawViewTeam | null;
  side: "affirmative" | "negative";
  debate: DrawViewDebate;
  active: boolean;
  eligible: boolean;
  onDrop: (teamId: string) => void;
  onRemove: () => void;
  onClickEmpty: () => void;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!eligible) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        try {
          const payload = JSON.parse(e.dataTransfer.getData("application/json")) as DragPayload;
          if (payload.teamId) onDrop(payload.teamId);
        } catch {
          /* ignore */
        }
      }}
      className={cn(
        "min-w-0 transition-colors",
        over && eligible && "bg-emerald-50",
        active && !eligible && "opacity-40"
      )}
      data-side={side}
      data-debate={debate.id}
    >
      {team ? (
        <TeamChip team={team} onRemove={onRemove} />
      ) : (
        <button
          type="button"
          onClick={onClickEmpty}
          className={cn(
            "flex h-9 w-full items-center justify-center border border-dashed text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            active && eligible && "border-emerald-400 text-emerald-700"
          )}
        >
          {active && eligible ? "Place here" : "Empty — drop a team"}
        </button>
      )}
    </div>
  );
}

export function MatchupsEditor({ view }: { view: DrawView }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [addingFor, setAddingFor] = React.useState<string | null>(null);

  const teamMap = React.useMemo(() => new Map(view.teams.map((t) => [t.id, t])), [view.teams]);
  const selectedTeam = selectedTeamId ? teamMap.get(selectedTeamId) ?? null : null;

  const run = (fn: () => Promise<unknown>, success?: string) =>
    startTransition(async () => {
      try {
        const result = (await fn()) as { displacedTeamId?: string | null } | void;
        if (success) toast.success(success);
        if (result && "displacedTeamId" in result && result.displacedTeamId) {
          const displaced = teamMap.get(result.displacedTeamId);
          if (displaced) toast.message(`${displaced.name} moved to the tray`);
        }
        setSelectedTeamId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });

  const place = (debateId: string, side: "affirmative" | "negative", teamId: string) =>
    run(() => placeTeam({ debateId, side, teamId }));

  const unallocated = view.unallocated.filter((t) =>
    query.trim() ? t.name.toLowerCase().includes(query.trim().toLowerCase()) : true
  );

  const venueName = new Map(view.venues.map((v) => [v.id, v.name]));
  const slotLabel = new Map(view.timeslots.map((t) => [t.id, t.label]));
  const divisionName = new Map(view.divisions.map((d) => [d.id, d.name]));

  // Tray grouped by venue / timeslot / division so the admin sees where each team belongs.
  const trayGroups = new Map<string, { label: string; teams: DrawViewTeam[] }>();
  for (const t of unallocated) {
    const label = [
      t.venueId ? venueName.get(t.venueId) : "No venue",
      t.timeslotId ? slotLabel.get(t.timeslotId) : "No timeslot",
      t.divisionId ? divisionName.get(t.divisionId) : "No division",
    ].join(" · ");
    const g = trayGroups.get(label) ?? { label, teams: [] };
    g.teams.push(t);
    trayGroups.set(label, g);
  }

  return (
    <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]", pending && "pointer-events-none opacity-70")}>
      <div className="space-y-8">
        {view.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms yet. Add one from a venue below or create the draw again.</p>
        ) : null}

        {view.groups.map((group) => {
          const venue = view.venues.find((v) => v.id === group.venueId);
          const usedRooms = new Set(group.debates.map((d) => d.roomId).filter(Boolean));
          const divisionsInGroup = [...new Set(group.debates.map((d) => d.divisionId).filter(Boolean))] as string[];
          return (
            <section key={group.key} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {group.venueName}
                <span className="font-normal text-muted-foreground">{group.timeslotLabel}</span>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {group.debates.length} room{group.debates.length === 1 ? "" : "s"}
                </span>
              </h2>

              <div className="border">
                <div className="grid grid-cols-[96px_56px_minmax(0,1fr)_32px_minmax(0,1fr)_minmax(0,140px)_40px] items-center gap-2 border-b bg-muted/40 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Room</span>
                  <span className="text-right">Brkt</span>
                  <span>Affirmative</span>
                  <span />
                  <span>Negative</span>
                  <span>Flags</span>
                  <span />
                </div>
                {group.debates.map((d) => {
                  const eligible = selectedTeam ? compatible(selectedTeam, d) : true;
                  return (
                    <div
                      key={d.id}
                      className="grid grid-cols-[96px_56px_minmax(0,1fr)_32px_minmax(0,1fr)_minmax(0,140px)_40px] items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
                    >
                      <select
                        value={d.roomId ?? ""}
                        onChange={(e) => run(() => setDebateRoom({ debateId: d.id, roomId: e.target.value || null }))}
                        className={cn("h-8 w-full border bg-background px-1 text-xs", !d.roomId && "border-amber-400 text-amber-800")}
                        aria-label="Room"
                      >
                        <option value="">No room</option>
                        {(venue?.rooms ?? []).map((r) => (
                          <option key={r.id} value={r.id} disabled={usedRooms.has(r.id) && r.id !== d.roomId}>
                            {r.identifier}
                          </option>
                        ))}
                      </select>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">{d.bracket ?? "—"}</span>
                      <Slot
                        team={d.affirmative}
                        side="affirmative"
                        debate={d}
                        active={!!selectedTeam}
                        eligible={eligible}
                        onDrop={(teamId) => place(d.id, "affirmative", teamId)}
                        onRemove={() => run(() => unplaceTeam({ debateId: d.id, side: "affirmative" }))}
                        onClickEmpty={() => selectedTeam && eligible && place(d.id, "affirmative", selectedTeam.id)}
                      />
                      <button
                        type="button"
                        onClick={() => run(() => swapSides(d.id))}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                        title="Swap sides"
                        aria-label="Swap sides"
                      >
                        <ArrowLeftRight className="size-4" />
                      </button>
                      <Slot
                        team={d.negative}
                        side="negative"
                        debate={d}
                        active={!!selectedTeam}
                        eligible={eligible}
                        onDrop={(teamId) => place(d.id, "negative", teamId)}
                        onRemove={() => run(() => unplaceTeam({ debateId: d.id, side: "negative" }))}
                        onClickEmpty={() => selectedTeam && eligible && place(d.id, "negative", selectedTeam.id)}
                      />
                      <div className="min-w-0 overflow-hidden">
                        <DrawFlags flags={d.flags} />
                        {d.divisionId && divisionsInGroup.length > 1 ? (
                          <DivisionChip
                            name={d.divisionName}
                            color={d.divisionChipColor}
                            className="mt-0.5 max-w-full truncate"
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            (d.affirmative || d.negative) &&
                            !window.confirm("Remove this room? Its teams return to the tray.")
                          ) {
                            return;
                          }
                          run(() => removeDebate(d.id), "Room removed");
                        }}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-destructive"
                        title="Remove room"
                        aria-label="Remove room"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2 border-t bg-muted/20 px-2 py-1.5">
                  {addingFor === group.key ? (
                    <>
                      <select
                        id={`add-${group.key}`}
                        className="h-8 border bg-background px-1 text-xs"
                        defaultValue={divisionsInGroup[0] ?? view.divisions[0]?.id ?? ""}
                        aria-label="Division for new room"
                      >
                        {view.divisions.map((dv) => (
                          <option key={dv.id} value={dv.id}>
                            {dv.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => {
                          const select = document.getElementById(`add-${group.key}`) as HTMLSelectElement | null;
                          const divisionId = select?.value;
                          if (!divisionId) return;
                          run(
                            () =>
                              addDebate({
                                roundId: view.round.id,
                                venueId: group.venueId,
                                timeslotId: group.timeslotId,
                                divisionId,
                              }),
                            "Room added"
                          );
                          setAddingFor(null);
                        }}
                      >
                        Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingFor(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingFor(group.key)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3.5" /> Add room
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {view.byes.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Byes</h2>
            <ul className="divide-y border">
              {view.byes.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{b.team.name}</span>
                  <span className="text-xs text-muted-foreground">{b.reason}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => run(() => removeBye(b.id), "Bye removed")}
                  >
                    Remove bye
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="border">
          <div className="space-y-2 border-b p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Unallocated teams</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{view.unallocated.length}</span>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams…"
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              Drag a team into a room, or click it and then click an empty slot.
            </p>
          </div>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
            {trayGroups.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                {view.unallocated.length === 0 ? "Every available team is placed." : "No teams match your search."}
              </p>
            ) : null}
            {[...trayGroups.values()].map((g) => (
              <div key={g.label} className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
                {g.teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <TeamChip
                        team={t}
                        dense
                        selected={selectedTeamId === t.id}
                        onSelect={() => setSelectedTeamId((cur) => (cur === t.id ? null : t.id))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => run(() => giveBye({ roundId: view.round.id, teamId: t.id }), "Bye given")}
                      className="h-8 shrink-0 border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      title="Give this team a bye"
                    >
                      Bye
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
