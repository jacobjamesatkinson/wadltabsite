"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAvailability } from "@/app/actions/adjudicators";
import { Button } from "@/components/ui/button";

export function AvailabilityToggle({
  adjudicatorId,
  timeslotId,
  available,
}: {
  adjudicatorId: string;
  timeslotId: string;
  available: boolean;
}) {
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={available ? "default" : "outline"}
      onClick={async () => {
        try {
          await setAvailability(adjudicatorId, timeslotId, !available);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      {available ? "Available" : "Unavailable"}
    </Button>
  );
}
