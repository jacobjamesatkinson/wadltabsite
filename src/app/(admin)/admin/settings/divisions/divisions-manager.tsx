"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDivision,
  deleteDivision,
  updateDivision,
} from "@/app/actions/competitions";
import { DeleteButton } from "@/components/delete-button";
import { DivisionChip } from "@/components/division-chip";
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

export type DivisionRow = {
  id: string;
  name: string;
  sortOrder: number;
  chipColor: string | null;
  teamCount: number;
};

export function DivisionsManager({
  competitionId,
  divisions,
}: {
  competitionId: string;
  divisions: DivisionRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [chipColor, setChipColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editChipColor, setEditChipColor] = useState("#3B82F6");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? divisions.filter((d) => d.name.toLowerCase().includes(q))
      : divisions;
    return [...list].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    );
  }, [divisions, query]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="division-search">Search divisions</Label>
        <Input
          id="division-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
        />
      </div>

      <form
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await createDivision({
                competitionId,
                name,
                chipColor,
              });
              toast.success("Division added");
              setName("");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="new-division-name">New division name</Label>
          <Input
            id="new-division-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Novice A"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-division-color">Chip colour</Label>
          <Input
            id="new-division-color"
            type="color"
            value={chipColor}
            onChange={(e) => setChipColor(e.target.value)}
            className="h-9 w-14 cursor-pointer p-1"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending || !name.trim()}>
            Add division
          </Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Sort</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="w-28">Colour</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No divisions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) =>
                editingId === d.id ? (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Input
                        type="number"
                        value={editSortOrder}
                        onChange={(e) =>
                          setEditSortOrder(Number(e.target.value))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        value={editChipColor}
                        onChange={(e) => setEditChipColor(e.target.value)}
                        className="h-9 w-14 cursor-pointer p-1"
                      />
                    </TableCell>
                    <TableCell>{d.teamCount}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        disabled={pending || !editName.trim()}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await updateDivision(d.id, {
                                name: editName,
                                sortOrder: editSortOrder,
                                chipColor: editChipColor,
                              });
                              toast.success("Division updated");
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
                  <TableRow key={d.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {d.sortOrder}
                    </TableCell>
                    <TableCell>
                      <DivisionChip name={d.name} color={d.chipColor} />
                    </TableCell>
                    <TableCell>
                      {d.chipColor ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className="inline-block size-4 rounded-sm border"
                            style={{ backgroundColor: d.chipColor }}
                            aria-hidden
                          />
                          {d.chipColor}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{d.teamCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(d.id);
                            setEditName(d.name);
                            setEditSortOrder(d.sortOrder);
                            setEditChipColor(d.chipColor ?? "#3B82F6");
                          }}
                        >
                          Edit
                        </Button>
                        <DeleteButton
                          confirmTitle={`Delete ${d.name}?`}
                          confirmDescription={
                            d.teamCount > 0
                              ? "This division still has teams and cannot be deleted until they are reassigned."
                              : "This cannot be undone."
                          }
                          onDelete={async () => {
                            await deleteDivision(d.id);
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
