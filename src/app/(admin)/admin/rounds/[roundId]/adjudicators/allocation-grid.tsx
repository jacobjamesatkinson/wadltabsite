"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Lock, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  autoAllocateVenue,
  clearVenueAllocation,
  setDebateAdjudicator,
} from "@/app/actions/adjudicators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AllocationAdjudicator,
  AllocationCell,
  AllocationData,
} from "@/lib/adjudicators/load";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { cn } from "@/lib/utils";

type UndoEntry = {
  debateId: string;
  /** Adjudicator that was in the seat before (null = empty). */
  previousAdjudicatorId: string | null;
  /** Adjudicator placed by the action (null = seat cleared). */
  placedAdjudicatorId: string | null;
};

type CellState = "open" | "locked" | "own" | "neutral";

function cellStateFor(
  adj: AllocationAdjudicator | null,
  cell: AllocationCell
): { state: CellState; reason: string | null } {
  if (!adj) return { state: "neutral", reason: null };
  if (!cell.timeslotId) return { state: "locked", reason: "No timeslot" };
  const placed = adj.placements[cell.timeslotId];
  if (placed && placed.debateId !== cell.debateId) {
    return { state: "locked", reason: `Already in ${placed.roomLabel} at this time` };
  }
  if (adj.unavailableTimeslotIds.includes(cell.timeslotId)) {
    return { state: "locked", reason: "Marked unavailable" };
  }
  if (
    (cell.affirmativeTeamId && adj.conflictTeamIds.includes(cell.affirmativeTeamId)) ||
    (cell.negativeTeamId && adj.conflictTeamIds.includes(cell.negativeTeamId)) ||
    cell.institutionIds.some((id) => adj.conflictInstitutionIds.includes(id))
  ) {
    return { state: "locked", reason: "Conflict with a team in this room" };
  }
  if (cell.institutionIds.some((id) => adj.ownInstitutionIds.includes(id))) {
    return { state: "own", reason: "Own school is debating here" };
  }
  return { state: "open", reason: null };
}

export function AllocationGrid({ data, venueId }: { data: AllocationData; venueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [undoStack, setUndoStack] = React.useState<UndoEntry[]>([]);

  const venue = data.venues.find((v) => v.id === venueId)!;
  const adjMap = React.useMemo(() => new Map(data.adjudicators.map((a) => [a.id, a])), [data.adjudicators]);
  const picked = pickedId ? adjMap.get(pickedId) ?? null : null;

  // Timeslots that have rooms at this venue (columns) and in the round (tray chips).
  const venueSlotIds = new Set(venue.cells.map((c) => c.timeslotId).filter(Boolean));
  const roundSlotIds = new Set(data.venues.flatMap((v) => v.cells.map((c) => c.timeslotId)).filter(Boolean));
  const columns = data.timeslots.filter((t) => venueSlotIds.has(t.id));
  const traySlots = data.timeslots.filter((t) => roundSlotIds.has(t.id));

  // Rows: physical rooms (plus a row for debates without a room).
  const roomRows = new Map<string, { label: string; cells: Map<string, AllocationCell[]> }>();
  const roomOrder = [...venue.rooms.map((r) => r.id), "__none"];
  for (const cell of venue.cells) {
    const key = cell.roomId ?? "__none";
    const row = roomRows.get(key) ?? { label: cell.roomId ? cell.roomLabel : "No room", cells: new Map() };
    const slotKey = cell.timeslotId ?? "__none";
    const list = row.cells.get(slotKey) ?? [];
    list.push(cell);
    row.cells.set(slotKey, list);
    roomRows.set(key, row);
  }
  const orderedRows = roomOrder.filter((id) => roomRows.has(id)).map((id) => ({ id, ...roomRows.get(id)! }));

  const run = (fn: () => Promise<{ warnings?: string[] } | void>, after?: () => void) =>
    startTransition(async () => {
      try {
        const result = await fn();
        for (const w of result?.warnings ?? []) toast.warning(w);
        after?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });

  const place = (cell: AllocationCell, adj: AllocationAdjudicator, replaceAssignmentId?: string) => {
    const previous = replaceAssignmentId
      ? cell.assignments.find((a) => a.id === replaceAssignmentId)?.adjudicatorId ?? null
      : null;
    run(
      () => setDebateAdjudicator({ debateId: cell.debateId, adjudicatorId: adj.id, replaceAssignmentId }),
      () => {
        setUndoStack((s) => [...s, { debateId: cell.debateId, previousAdjudicatorId: previous, placedAdjudicatorId: adj.id }]);
        setPickedId(null);
      }
    );
  };

  const clear = (cell: AllocationCell, assignmentId: string) => {
    const previous = cell.assignments.find((a) => a.id === assignmentId)?.adjudicatorId ?? null;
    run(
      () => setDebateAdjudicator({ debateId: cell.debateId, adjudicatorId: null, replaceAssignmentId: assignmentId }),
      () => setUndoStack((s) => [...s, { debateId: cell.debateId, previousAdjudicatorId: previous, placedAdjudicatorId: null }])
    );
  };

  const undo = () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    const cell = data.venues.flatMap((v) => v.cells).find((c) => c.debateId === entry.debateId);
    if (!cell) {
      setUndoStack((s) => s.slice(0, -1));
      return;
    }
    const current = entry.placedAdjudicatorId
      ? cell.assignments.find((a) => a.adjudicatorId === entry.placedAdjudicatorId)
      : undefined;
    run(
      () =>
        setDebateAdjudicator({
          debateId: entry.debateId,
          adjudicatorId: entry.previousAdjudicatorId,
          replaceAssignmentId: current?.id ?? null,
        }),
      () => setUndoStack((s) => s.slice(0, -1))
    );
  };

  const onCellClick = (cell: AllocationCell, replaceAssignmentId?: string) => {
    if (!picked) return;
    const { state, reason } = cellStateFor(picked, cell);
    if (state === "locked") {
      toast.error(`${picked.name}: ${reason}`);
      return;
    }
    place(cell, picked, replaceAssignmentId);
  };

  const filteredAdjs = data.adjudicators.filter((a) =>
    query.trim() ? a.name.toLowerCase().includes(query.trim().toLowerCase()) : true
  );

  return (
    <div className={cn("space-y-4", pending && "pointer-events-none opacity-70")}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 border border-emerald-400 bg-emerald-50" /> Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 border bg-muted" /> Locked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 border border-amber-400 bg-amber-50" /> Own school
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={undoStack.length === 0} onClick={undo}>
            <RotateCcw className="size-3.5" /> Undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(() => autoAllocateVenue({ roundId: data.round.id, venueId }).then((r) => {
              toast.success(`${r.assigned} allocated${r.unfilled ? `, ${r.unfilled} still empty` : ""}`);
              return { warnings: r.warnings.slice(0, 5) };
            }))}
          >
            <Sparkles className="size-3.5" /> Auto-allocate {venue.name}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!window.confirm(`Remove every allocation at ${venue.name}?`)) return;
              run(() => clearVenueAllocation({ roundId: data.round.id, venueId }), () => setUndoStack([]));
            }}
          >
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Pick an adjudicator from the list, or click one already placed, then choose a room. Anyone
        already in a timeslot is locked out of it.
        {picked ? (
          <span className="ml-2 font-medium text-foreground">
            Placing {picked.name}
            <button type="button" onClick={() => setPickedId(null)} className="ml-1 text-xs underline underline-offset-2">
              cancel
            </button>
          </span>
        ) : null}
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-x-auto border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs">
                <th className="w-24 border-b border-r px-2 py-2 font-medium text-muted-foreground">Room</th>
                {columns.map((slot) => {
                  const cells = venue.cells.filter((c) => c.timeslotId === slot.id);
                  const done = cells.filter((c) => c.assignments.length >= data.panelSize).length;
                  return (
                    <th key={slot.id} className="border-b border-r px-2 py-2 last:border-r-0">
                      <span className="font-semibold text-foreground">{formatTimeslotTime(slot.startsAt)}</span>
                      <span className={cn("ml-2 font-normal tabular-nums", done === cells.length ? "text-emerald-700" : "text-muted-foreground")}>
                        {done} of {cells.length} allocated
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <th className="border-r px-2 py-2 text-left align-top font-medium">{row.label}</th>
                  {columns.map((slot) => {
                    const cells = row.cells.get(slot.id) ?? [];
                    return (
                      <td key={slot.id} className="border-r p-1.5 align-top last:border-r-0">
                        <div className="space-y-1.5">
                          {cells.map((cell) => (
                            <GridCell
                              key={cell.debateId}
                              cell={cell}
                              picked={picked}
                              panelSize={data.panelSize}
                              adjMap={adjMap}
                              onPickPlaced={(id) => setPickedId((cur) => (cur === id ? null : id))}
                              onClickSeat={(replaceAssignmentId) => onCellClick(cell, replaceAssignmentId)}
                              onClear={(assignmentId) => clear(cell, assignmentId)}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="border">
            <div className="space-y-2 border-b p-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Adjudicators</h2>
                <span className="text-xs text-muted-foreground">{data.adjudicators.length} people</span>
              </div>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-8" />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 text-[11px] text-muted-foreground">
                <span>Where each one is, per timeslot</span>
                <span className="flex gap-1">
                  {traySlots.map((s) => (
                    <span key={s.id} className="w-12 text-center">{formatTimeslotTime(s.startsAt).replace(/\s?[ap]m$/i, "")}</span>
                  ))}
                </span>
              </div>
            </div>
            <ul className="max-h-[70vh] divide-y overflow-y-auto">
              {filteredAdjs.map((adj) => {
                const active = adj.id === pickedId;
                return (
                  <li key={adj.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId((cur) => (cur === adj.id ? null : adj.id))}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left hover:bg-muted/50",
                        active && "bg-foreground text-background hover:bg-foreground"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{adj.name}</span>
                        <span className={cn("block truncate text-xs", active ? "text-background/70" : "text-muted-foreground")}>
                          {adj.ownInstitutionNames[0] ?? "Independent"}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        {traySlots.map((s) => {
                          const placed = adj.placements[s.id];
                          const away = adj.unavailableTimeslotIds.includes(s.id);
                          return (
                            <span
                              key={s.id}
                              title={placed ? `${placed.roomLabel}${placed.venueId && placed.venueId !== venueId ? " (other venue)" : ""}` : away ? "Unavailable" : "Free"}
                              className={cn(
                                "inline-flex h-6 w-12 items-center justify-center border text-[11px] tabular-nums",
                                placed
                                  ? active
                                    ? "border-background/40 bg-background/20 font-medium"
                                    : "border-foreground/30 bg-foreground/5 font-medium"
                                  : away
                                    ? active
                                      ? "border-background/20 text-background/50"
                                      : "border-dashed text-muted-foreground/70"
                                    : active
                                      ? "border-background/20 text-background/70"
                                      : "text-muted-foreground"
                              )}
                            >
                              {placed ? `R${placed.roomLabel.replace(/^room\s*/i, "")}` : away ? "away" : "free"}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function GridCell({
  cell,
  picked,
  panelSize,
  adjMap,
  onPickPlaced,
  onClickSeat,
  onClear,
}: {
  cell: AllocationCell;
  picked: AllocationAdjudicator | null;
  panelSize: number;
  adjMap: Map<string, AllocationAdjudicator>;
  onPickPlaced: (adjudicatorId: string) => void;
  onClickSeat: (replaceAssignmentId?: string) => void;
  onClear: (assignmentId: string) => void;
}) {
  const { state, reason } = cellStateFor(picked, cell);
  const emptySeats = Math.max(0, panelSize - cell.assignments.length);
  const ownSchool = (adjId: string) => {
    const adj = adjMap.get(adjId);
    return adj ? cell.institutionIds.some((id) => adj.ownInstitutionIds.includes(id)) : false;
  };

  return (
    <div
      className={cn(
        "space-y-1 border p-1.5",
        state === "open" && "border-emerald-400 bg-emerald-50/60",
        state === "own" && "border-amber-400 bg-amber-50/60",
        state === "locked" && "bg-muted/60 opacity-60"
      )}
      title={reason ?? undefined}
    >
      <div className="space-y-0.5 text-xs">
        <div className="flex gap-1.5">
          <span className="w-7 shrink-0 font-semibold text-muted-foreground">AFF</span>
          <span className={cn("truncate", !cell.affirmative && "text-destructive")}>{cell.affirmative ?? "Missing"}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="w-7 shrink-0 font-semibold text-muted-foreground">NEG</span>
          <span className={cn("truncate", !cell.negative && "text-destructive")}>{cell.negative ?? "Missing"}</span>
        </div>
      </div>
      <div className="space-y-1">
        {cell.assignments.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex h-7 items-center gap-1 border bg-background px-1.5 text-xs",
              picked?.id === a.adjudicatorId && "border-foreground ring-2 ring-foreground/20"
            )}
          >
            <button
              type="button"
              onClick={() => (picked && picked.id !== a.adjudicatorId ? onClickSeat(a.id) : onPickPlaced(a.adjudicatorId))}
              className="min-w-0 flex-1 truncate text-left font-medium"
              title={picked && picked.id !== a.adjudicatorId ? `Replace with ${picked.name}` : "Click to move"}
            >
              {a.adjudicatorName}
            </button>
            {ownSchool(a.adjudicatorId) ? (
              <span className="shrink-0 border border-amber-300 bg-amber-50 px-1 text-[10px] text-amber-900">Own school</span>
            ) : null}
            <button
              type="button"
              onClick={() => onClear(a.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${a.adjudicatorName}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: emptySeats }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            disabled={!picked || state === "locked"}
            onClick={() => onClickSeat()}
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1 border border-dashed text-[11px]",
              state === "open" && "border-emerald-500 text-emerald-800",
              state === "own" && "border-amber-500 text-amber-900",
              state === "locked" && "text-muted-foreground",
              state === "neutral" && "text-muted-foreground"
            )}
          >
            {state === "locked" ? <Lock className="size-3" /> : null}
            {picked && state !== "locked" ? `Place ${picked.name.split(" ")[0]}` : "Unallocated"}
          </button>
        ))}
      </div>
    </div>
  );
}
