"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCompetitionTimeslot,
  deleteCompetitionTimeslot,
  updateCompetitionTimeslot,
} from "@/app/actions/timeslots";
import { DeleteButton } from "@/components/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimeslotTime } from "@/lib/timeslots/format";

export type TimeslotRow = {
  id: string;
  startsAt: string;
  teamCount: number;
};

export function TimeslotsManager({
  competitionId,
  timeslots,
}: {
  competitionId: string;
  timeslots: TimeslotRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState("16:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartsAt, setEditStartsAt] = useState("16:00");

  const sorted = useMemo(
    () =>
      [...timeslots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [timeslots]
  );

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await createCompetitionTimeslot({ competitionId, startsAt });
              toast.success("Timeslot added");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="new-timeslot-time">Start time</Label>
          <Input
            id="new-timeslot-time"
            type="time"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending || !startsAt}>
            Add timeslot
          </Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead className="w-24">Teams</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No timeslots yet
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>
                    {editingId === slot.id ? (
                      <Input
                        type="time"
                        value={editStartsAt}
                        onChange={(e) => setEditStartsAt(e.target.value)}
                        className="h-8 w-36"
                      />
                    ) : (
                      formatTimeslotTime(slot.startsAt)
                    )}
                  </TableCell>
                  <TableCell>{slot.teamCount}</TableCell>
                  <TableCell className="text-right">
                    {editingId === slot.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={pending || !editStartsAt}
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await updateCompetitionTimeslot(slot.id, {
                                  startsAt: editStartsAt,
                                });
                                toast.success("Timeslot updated");
                                setEditingId(null);
                                router.refresh();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed"
                                );
                              }
                            });
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(slot.id);
                            setEditStartsAt(slot.startsAt);
                          }}
                        >
                          Edit
                        </Button>
                        <DeleteButton
                          confirmTitle={`Delete ${formatTimeslotTime(slot.startsAt)}?`}
                          confirmDescription={
                            slot.teamCount > 0
                              ? "Reassign teams first — this timeslot is still in use."
                              : "This cannot be undone."
                          }
                          onDelete={async () => {
                            await deleteCompetitionTimeslot(slot.id);
                          }}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
