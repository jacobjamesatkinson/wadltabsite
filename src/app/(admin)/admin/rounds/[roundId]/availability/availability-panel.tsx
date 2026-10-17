"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  setAdjudicatorRoundAvailability,
  setRoomAvailability,
  setTeamAvailability,
  type AvailabilityItem,
} from "@/app/actions/availability";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";

function AvailabilityCard({
  title,
  items,
  editHref,
  editLabel,
  onToggle,
}: {
  title: string;
  items: AvailabilityItem[];
  editHref: string;
  editLabel: string;
  onToggle: (id: string, available: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const availableCount = items.filter((i) => i.available).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((availableCount / total) * 100);

  return (
    <div className="flex flex-col border bg-card">
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="text-sm font-semibold tabular-nums">
              {availableCount}/{total}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await onToggle(item.id, !item.available);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Update failed"
                      );
                    }
                  })
                }
                className={cn(
                  "flex w-full items-center justify-between border px-3 py-2 text-left text-sm transition-colors",
                  item.available
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="truncate">{item.name}</span>
                <span className="text-xs font-medium uppercase tracking-wide">
                  {item.available ? "On" : "Off"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto border-t">
        <Button
          variant="ghost"
          className="h-11 w-full justify-between px-5 text-primary"
          render={<Link href={editHref} />}
        >
          <span className="inline-flex items-center gap-2">
            <Pencil className="size-4" />
            {editLabel}
          </span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function AvailabilityPanel({
  roundId,
  teams,
  adjudicators,
  rooms,
}: {
  roundId: string;
  teams: AvailabilityItem[];
  adjudicators: AvailabilityItem[];
  rooms: AvailabilityItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refreshAfter(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-3",
        busy && "pointer-events-none opacity-70"
      )}
    >
      <AvailabilityCard
        title="Teams"
        items={teams}
        editHref={`/admin/teams`}
        editLabel="Edit team availability"
        onToggle={(id, available) =>
          refreshAfter(() => setTeamAvailability(roundId, id, available))
        }
      />
      <AvailabilityCard
        title="Adjudicators"
        items={adjudicators}
        editHref={`/admin/adjudicators`}
        editLabel="Edit adjudicator availability"
        onToggle={(id, available) =>
          refreshAfter(() =>
            setAdjudicatorRoundAvailability(roundId, id, available)
          )
        }
      />
      <AvailabilityCard
        title="Rooms"
        items={rooms}
        editHref={`/admin/venues`}
        editLabel="Edit room availability"
        onToggle={(id, available) =>
          refreshAfter(() => setRoomAvailability(roundId, id, available))
        }
      />
    </div>
  );
}
