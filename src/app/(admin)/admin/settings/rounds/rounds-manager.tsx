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

export type RoundRow = {
  id: string;
  name: string;
  number: number;
  date: string;
  drawStatus: string;
};

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
        className="grid gap-3 border p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await addRound(competitionId, name, Number(number));
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
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="new-round-name">New round name</Label>
          <Input
            id="new-round-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <div className="flex items-end">
          <Button type="submit" disabled={pending || !name} className="w-full">
            Add round
          </Button>
        </div>
      </form>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
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
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </TableCell>
                    <TableCell>{r.drawStatus}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await updateRound(r.id, {
                                name: editName,
                                number: Number(editNumber),
                                date: editDate || null,
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
                    <TableCell>{r.date}</TableCell>
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
                            setEditDate(r.date === "—" ? "" : r.date);
                          }}
                        >
                          Edit
                        </Button>
                        <DeleteButton
                          confirmTitle={`Delete ${r.name}?`}
                          confirmDescription="Timeslots for this round will also be removed."
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
