"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setAdjudicatorTimeslotAvailability } from "@/app/actions/availability";
import { Button } from "@/components/ui/button";

export function AvailabilityToggle({
  roundId,
  adjudicatorId,
  timeslotId,
  available,
  disabled,
}: {
  roundId: string;
  adjudicatorId: string;
  timeslotId: string;
  available: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={available ? "default" : "outline"}
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await setAdjudicatorTimeslotAvailability(roundId, adjudicatorId, timeslotId, !available);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        })
      }
    >
      {available ? "Available" : "Unavailable"}
    </Button>
  );
}
