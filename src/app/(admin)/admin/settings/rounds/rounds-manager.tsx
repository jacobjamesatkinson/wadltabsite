"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addRound,
  deleteRound,
  updateRound,
} from "@/app/actions/competitions";
import { DeleteButton } from "@/components/delete-button";
import { MondayDatePicker } from "@/components/monday-date-picker";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatDisplayDate,
  parseLocalDate,
  rosterSchedule,
} from "@/lib/roster/dates";

export type RoundRow = {
  id: string;
  name: string;
  number: number;
  /** YYYY-MM-DD or empty */
  date: string;
  drawStatus: string;
};

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

export function RoundsManager({
  competitionId,
  rounds,
}: {
  competitionId: string;
  rounds: RoundRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [number, setNumber] = useState(String((rounds.at(-1)?.number ?? 0) + 1));
  const [startDate, setStartDate] = useState(nextMondayIso());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editDate, setEditDate] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rounds;
    return rounds.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.number).includes(q) ||
        r.drawStatus.toLowerCase().includes(q)
    );
  }, [rounds, query]);

  const previewSchedule = useMemo(() => {
    try {
      return rosterSchedule(parseLocalDate(startDate));
    } catch {
      return null;
    }
  }, [startDate]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="round-search">Search rounds</Label>
        <Input
          id="round-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, number, status…"
        />
      </div>

      <form
        className="space-y-4 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await addRound(
                competitionId,
                name,
                Number(number),
                startDate
              );
              toast.success("Round added");
              setName("");
              setNumber(String(Number(number) + 1));
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="new-round-name">Round name</Label>
            <Input
              id="new-round-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Round 1"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-round-number">Number</Label>
            <Input
              id="new-round-number"
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1 max-w-sm">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="new-round-start">Start date (Monday)</Label>
            {previewSchedule ? (
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      />
                    }
                  >
                    Roster calendar
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="max-w-none p-0 text-background"
                  >
                    <table className="text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-background/20">
                          <th className="px-2.5 py-1.5 font-medium">Roster</th>
                          <th className="px-2.5 py-1.5 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewSchedule.map((row) => (
                          <tr key={row.label}>
                            <td className="whitespace-nowrap px-2.5 py-1">
                              {row.label}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-1 opacity-90">
                              {formatDisplayDate(row.date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <MondayDatePicker
            id="new-round-start"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <Button type="submit" disabled={pending || !name || !startDate}>
          Add round
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Start (Monday)</TableHead>
              <TableHead>Draw</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No rounds found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) =>
                editingId === r.id ? (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Input
                        type="number"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <MondayDatePicker
                        value={editDate}
                        onChange={setEditDate}
                      />
                    </TableCell>
                    <TableCell>{r.drawStatus}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        disabled={pending || !editDate}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await updateRound(r.id, {
                                name: editName,
                                number: Number(editNumber),
                                date: editDate,
                              });
                              toast.success("Round updated");
                              setEditingId(null);
                              router.refresh();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Failed"
                              );
                            }
                          })
                        }
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
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={r.id}>
                    <TableCell>{r.number}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {r.date
                        ? formatDisplayDate(parseLocalDate(r.date))
                        : "—"}
                    </TableCell>
                    <TableCell>{r.drawStatus}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditName(r.name);
                            setEditNumber(String(r.number));
                            setEditDate(r.date);
                          }}
                        >
                          Edit
                        </Button>
                        <DeleteButton
                          confirmTitle={`Delete ${r.name}?`}
                          confirmDescription="This cannot be undone."
                          onDelete={async () => {
                            await deleteRound(r.id);
                            router.refresh();
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
