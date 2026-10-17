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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return divisions;
    return divisions.filter((d) => d.name.toLowerCase().includes(q));
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
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await createDivision({ competitionId, name });
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
              <TableHead>Division</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No divisions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) =>
                editingId === d.id ? (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
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
                              await updateDivision(d.id, { name: editName });
                              toast.success("Division renamed");
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
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.teamCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(d.id);
                            setEditName(d.name);
                          }}
                        >
                          Rename
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
