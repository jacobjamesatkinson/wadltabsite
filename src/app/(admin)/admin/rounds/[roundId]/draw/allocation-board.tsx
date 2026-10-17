"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { updateDebateAssignment } from "@/app/actions/draws";
import {
  assignAdjudicator,
  removeAssignment,
} from "@/app/actions/adjudicators";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AllocationDebate = {
  id: string;
  roomLabel: string;
  timeslotLabel: string;
  affirmative: { id: string; name: string } | null;
  negative: { id: string; name: string } | null;
  adjudicators: { assignmentId: string; id: string; name: string }[];
};

export type PoolItem = { id: string; name: string };

function Chip({
  id,
  label,
  type,
  dragging,
}: {
  id: string;
  label: string;
  type: "team" | "adjudicator" | "room";
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${type}:${id}`,
    data: { type, entityId: id, label },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cn(
        "inline-flex cursor-grab items-center border bg-background px-2 py-1 text-xs font-medium active:cursor-grabbing",
        (isDragging || dragging) && "opacity-40",
        type === "adjudicator"
          ? "border-violet-300 text-violet-800"
          : type === "room"
            ? "border-amber-300 text-amber-900"
            : "border-sky-300 text-sky-900"
      )}
    >
      {label}
    </button>
  );
}

function RoomDrop({
  debate,
  mode,
}: {
  debate: AllocationDebate;
  mode: "sides" | "adjudicators" | "rooms";
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `debate:${debate.id}`,
    data: { debateId: debate.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-2 border p-3",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{debate.roomLabel}</span>
        <span>{debate.timeslotLabel}</span>
      </div>
      {mode === "sides" || mode === "rooms" ? (
        <div className="flex flex-wrap gap-2">
          {debate.affirmative ? (
            <Chip
              id={debate.affirmative.id}
              label={`Aff · ${debate.affirmative.name}`}
              type="team"
            />
          ) : (
            <Badge variant="outline">Aff empty</Badge>
          )}
          {debate.negative ? (
            <Chip
              id={debate.negative.id}
              label={`Neg · ${debate.negative.name}`}
              type="team"
            />
          ) : (
            <Badge variant="outline">Neg empty</Badge>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {debate.adjudicators.length === 0 ? (
            <Badge variant="outline">No adjudicators</Badge>
          ) : (
            debate.adjudicators.map((a) => (
              <Chip key={a.assignmentId} id={a.id} label={a.name} type="adjudicator" />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AllocationBoard({
  debates,
  teamPool,
  adjudicatorPool,
  rooms,
}: {
  debates: AllocationDebate[];
  teamPool: PoolItem[];
  adjudicatorPool: PoolItem[];
  rooms: PoolItem[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"sides" | "adjudicators" | "rooms">("sides");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const assignedTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of debates) {
      if (d.affirmative) ids.add(d.affirmative.id);
      if (d.negative) ids.add(d.negative.id);
    }
    return ids;
  }, [debates]);

  const assignedAdjIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of debates) {
      for (const a of d.adjudicators) ids.add(a.id);
    }
    return ids;
  }, [debates]);

  const freeTeams = teamPool.filter((t) => !assignedTeamIds.has(t.id));
  const freeAdjs = adjudicatorPool.filter((a) => !assignedAdjIds.has(a.id));

  function onDragStart(event: DragStartEvent) {
    const label = event.active.data.current?.label;
    setActiveLabel(typeof label === "string" ? label : null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveLabel(null);
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("debate:")) return;
    const debateId = overId.replace("debate:", "");
    const type = event.active.data.current?.type as string | undefined;
    const entityId = event.active.data.current?.entityId as string | undefined;
    if (!type || !entityId) return;

    startTransition(async () => {
      try {
        if (mode === "sides" && type === "team") {
          const debate = debates.find((d) => d.id === debateId);
          if (!debate) return;
          if (!debate.affirmative) {
            await updateDebateAssignment({ debateId, affirmativeTeamId: entityId });
          } else if (!debate.negative) {
            await updateDebateAssignment({ debateId, negativeTeamId: entityId });
          } else {
            await updateDebateAssignment({ debateId, affirmativeTeamId: entityId });
          }
        } else if (mode === "adjudicators" && type === "adjudicator") {
          const debate = debates.find((d) => d.id === debateId);
          const existing = debate?.adjudicators.find((a) => a.id === entityId);
          if (existing) {
            await removeAssignment(existing.assignmentId);
          }
          // Remove from previous room if any
          for (const d of debates) {
            const hit = d.adjudicators.find((a) => a.id === entityId);
            if (hit) await removeAssignment(hit.assignmentId);
          }
          await assignAdjudicator(debateId, entityId, "chair");
        } else if (mode === "rooms" && type === "room") {
          await updateDebateAssignment({ debateId, roomId: entityId });
        }
        toast.success("Allocation updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Allocation failed");
      }
    });
  }

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as typeof mode)}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="sides">Edit sides / matchups</TabsTrigger>
          <TabsTrigger value="adjudicators">Adjudicator allocations</TabsTrigger>
          <TabsTrigger value="rooms">Room allocations</TabsTrigger>
        </TabsList>

        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <TabsContent value="sides" className="space-y-4">
            <Pool title="Unassigned teams" items={freeTeams} type="team" />
            <RoomGrid debates={debates} mode="sides" />
          </TabsContent>
          <TabsContent value="adjudicators" className="space-y-4">
            <Pool title="Available adjudicators" items={freeAdjs} type="adjudicator" />
            <RoomGrid debates={debates} mode="adjudicators" />
          </TabsContent>
          <TabsContent value="rooms" className="space-y-4">
            <div className="space-y-2 border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rooms
              </p>
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <Chip key={r.id} id={r.id} label={r.name} type="room" />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag a room chip onto a debate to assign that room.
            </p>
            <RoomGrid debates={debates} mode="rooms" />
          </TabsContent>
          <DragOverlay>
            {activeLabel ? (
              <span className="border bg-background px-2 py-1 text-xs shadow">{activeLabel}</span>
            ) : null}
          </DragOverlay>
        </DndContext>
      </Tabs>
    </div>
  );
}

function Pool({
  title,
  items,
  type,
}: {
  title: string;
  items: PoolItem[];
  type: "team" | "adjudicator";
}) {
  return (
    <div className="space-y-2 border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          items.map((item) => (
            <Chip key={item.id} id={item.id} label={item.name} type={type} />
          ))
        )}
      </div>
    </div>
  );
}

function RoomGrid({
  debates,
  mode,
}: {
  debates: AllocationDebate[];
  mode: "sides" | "adjudicators" | "rooms";
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {debates.map((debate) => (
        <RoomDrop key={debate.id} debate={debate} mode={mode} />
      ))}
    </div>
  );
}
