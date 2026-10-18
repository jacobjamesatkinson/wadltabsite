"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addRound } from "@/app/actions/competitions";
import { MondayDatePicker } from "@/components/monday-date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function nextMondayIso() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const add = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + add);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

export function AddRoundForm({
  competitionId,
  nextNumber,
}: {
  competitionId: string;
  nextNumber: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(nextMondayIso());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Start Monday</Label>
        <MondayDatePicker
          value={startDate}
          onChange={setStartDate}
          className="w-56"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !startDate}
        onClick={() => {
          startTransition(async () => {
            try {
              await addRound(
                competitionId,
                `Round ${nextNumber}`,
                nextNumber,
                startDate
              );
              toast.success("Round added");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        Add round
      </Button>
    </div>
  );
}
