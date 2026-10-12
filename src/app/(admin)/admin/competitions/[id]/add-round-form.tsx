"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addRound } from "@/app/actions/competitions";
import { Button } from "@/components/ui/button";

export function AddRoundForm({
  competitionId,
  nextNumber,
}: {
  competitionId: string;
  nextNumber: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await addRound(competitionId, `Round ${nextNumber}`, nextNumber);
          toast.success("Round added");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      Add round
    </Button>
  );
}
