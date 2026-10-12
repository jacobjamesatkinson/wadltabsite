import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  rooms,
  timeslots,
  user,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignAdjForm } from "./assign-form";

export default async function HaDrawPage() {
  const [debateRows, roomRows, slotRows, assignments, profiles, users] =
    await Promise.all([
      db.query.debates.findMany(),
      db.select().from(rooms),
      db.select().from(timeslots),
      db.select().from(adjudicatorAssignments),
      db.select().from(adjudicatorProfiles),
      db.select().from(user),
    ]);

  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Group by timeslot for logical venue view
  const bySlot = new Map<string, typeof debateRows>();
  for (const d of debateRows) {
    const key = d.timeslotId ?? "unscheduled";
    const list = bySlot.get(key) ?? [];
    list.push(d);
    bySlot.set(key, list);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Draw and assignments"
        description="Debate list and logical venue views stay in sync"
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">A. Debate list</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timeslot</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Adjudicators</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debateRows.map((d) => {
                const adjs = assignments.filter((a) => a.debateId === d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.timeslotId ? slotMap.get(d.timeslotId)?.label : "—"}
                    </TableCell>
                    <TableCell>
                      {d.roomId ? roomMap.get(d.roomId)?.identifier : "—"}
                    </TableCell>
                    <TableCell>
                      {d.affirmativeTeamName} vs {d.negativeTeamName}
                    </TableCell>
                    <TableCell>
                      {adjs.length === 0 ? (
                        <Badge variant="outline">Unassigned</Badge>
                      ) : (
                        adjs.map((a) => {
                          const p = profileMap.get(a.adjudicatorId);
                          const u = p ? userMap.get(p.userId) : null;
                          return (
                            <span key={a.id} className="mr-1 text-xs">
                              {u?.name ?? a.adjudicatorId} ({a.role})
                            </span>
                          );
                        })
                      )}
                    </TableCell>
                    <TableCell>{d.status}</TableCell>
                    <TableCell className="text-right">
                      <AssignAdjForm
                        debateId={d.id}
                        adjudicators={profiles.map((p) => ({
                          id: p.id,
                          name: userMap.get(p.userId)?.name ?? p.id,
                        }))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">B. Logical venue view</h2>
        {[...bySlot.entries()].map(([slotId, list]) => (
          <div key={slotId} className="space-y-2">
            <h3 className="text-sm font-medium">
              {slotId === "unscheduled"
                ? "Unscheduled"
                : slotMap.get(slotId)?.label ?? slotId}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((d) => (
                <div key={d.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    Room {d.roomId ? roomMap.get(d.roomId)?.identifier : "—"}
                  </p>
                  <p>
                    {d.affirmativeTeamName} vs {d.negativeTeamName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Adjs:{" "}
                    {assignments.filter((a) => a.debateId === d.id).length ||
                      "none"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">C. Physical venue view</h2>
        <p>
          No floor plan is configured. Use the logical room layout above. When a
          floor plan JSON is attached to a venue, room coordinates render here.
        </p>
      </section>
    </div>
  );
}
