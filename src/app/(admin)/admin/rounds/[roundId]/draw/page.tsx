import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  debates,
  divisions,
  rooms,
  timeslots,
  user,
  venues,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RoundStepNav } from "../round-step-nav";
import { DrawActions } from "@/app/(admin)/admin/draws/[roundId]/draw-actions";
import { AllocationBoard } from "./allocation-board";
import { DrawDataTable } from "./draw-table";

export default async function RoundDrawPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();

  const [
    debateRows,
    roomRows,
    slotRows,
    venueRows,
    divisionRows,
    assignmentRows,
    adjProfiles,
    users,
    versions,
  ] = await Promise.all([
    db.select().from(debates).where(eq(debates.roundId, roundId)),
    db.select().from(rooms),
    db.select().from(timeslots).where(eq(timeslots.roundId, roundId)),
    db.select().from(venues),
    db.select().from(divisions),
    db.select().from(adjudicatorAssignments),
    db.select().from(adjudicatorProfiles),
    db.select({ id: user.id, name: user.name }).from(user),
    db.query.drawVersions.findMany({
      where: (t, { eq: e }) => e(t.roundId, roundId),
    }),
  ]);

  const latest = [...versions].sort((a, b) => b.version - a.version)[0];
  const hard = (latest?.hardViolations as string[] | undefined) ?? [];
  const soft = (latest?.softWarnings as string[] | undefined) ?? [];

  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v.name]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s.label]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(
    adjProfiles.map((a) => [a.id, userName.get(a.userId) ?? a.id])
  );

  const assignmentsByDebate = new Map<
    string,
    { assignmentId: string; id: string; name: string }[]
  >();
  for (const a of assignmentRows) {
    const list = assignmentsByDebate.get(a.debateId) ?? [];
    list.push({
      assignmentId: a.id,
      id: a.adjudicatorId,
      name: adjName.get(a.adjudicatorId) ?? a.adjudicatorId,
    });
    assignmentsByDebate.set(a.debateId, list);
  }

  const tableRows = debateRows.map((d) => {
    const room = d.roomId ? roomMap.get(d.roomId) : undefined;
    const venueName = room
      ? venueMap.get(room.venueId) ?? "—"
      : d.venueId
        ? venueMap.get(d.venueId) ?? "—"
        : "—";
    const adjs = assignmentsByDebate.get(d.id) ?? [];
    const flags = [
      d.isPullUp ? "pull-up" : null,
      d.isRematch ? "rematch" : null,
      d.isSameInstitution ? "same-inst" : null,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      id: d.id,
      venue: venueName,
      room: room?.identifier ?? "—",
      timeslot: d.timeslotId ? slotMap.get(d.timeslotId) ?? "—" : "—",
      affirmative: d.affirmativeTeamName ?? "—",
      negative: d.negativeTeamName ?? "—",
      adjudicators: adjs.map((a) => a.name).join(", ") || "—",
      division: d.divisionId ? divMap.get(d.divisionId) ?? "—" : "—",
      flags: flags || "—",
    };
  });

  const allocationDebates = debateRows.map((d) => {
    const room = d.roomId ? roomMap.get(d.roomId) : undefined;
    return {
      id: d.id,
      roomLabel: room?.identifier ?? "Unassigned room",
      timeslotLabel: d.timeslotId ? slotMap.get(d.timeslotId) ?? "—" : "—",
      affirmative: d.affirmativeTeamId
        ? { id: d.affirmativeTeamId, name: d.affirmativeTeamName ?? "Team" }
        : null,
      negative: d.negativeTeamId
        ? { id: d.negativeTeamId, name: d.negativeTeamName ?? "Team" }
        : null,
      adjudicators: assignmentsByDebate.get(d.id) ?? [],
    };
  });

  const teamPool = (
    await db.query.teams.findMany({
      where: (t, { eq: e }) => e(t.status, "active"),
    })
  ).map((t) => ({ id: t.id, name: t.name }));

  const adjudicatorPool = adjProfiles
    .filter((a) => a.active)
    .map((a) => ({ id: a.id, name: adjName.get(a.id) ?? a.id }));

  const roomPool = roomRows.map((r) => ({ id: r.id, name: r.identifier }));

  const uniq = (values: string[]) =>
    [...new Set(values.filter((v) => v && v !== "—"))].map((v) => ({
      label: v,
      value: v,
    }));

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="draw" />
      <PageHeader
        title="Draw"
        description={`Status: ${round.drawStatus}. Generate the draw, then allocate rooms and adjudicators.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <DrawActions
              roundId={roundId}
              drawStatus={round.drawStatus}
              hasHard={hard.length > 0}
            />
            <Button
              variant="outline"
              render={<Link href={`/admin/rounds/${roundId}/display`} />}
            >
              Next: Display
            </Button>
          </div>
        }
      />

      {hard.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Hard constraint violations</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {hard.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {soft.length > 0 ? (
        <Alert>
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {soft.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Allocations</h2>
        {debateRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Generate a draft draw to start allocating sides, rooms and adjudicators.
          </p>
        ) : (
          <AllocationBoard
            debates={allocationDebates}
            teamPool={teamPool}
            adjudicatorPool={adjudicatorPool}
            rooms={roomPool}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Draw table ({debateRows.length})
        </h2>
        <DrawDataTable
          data={tableRows}
          venueOptions={uniq(tableRows.map((r) => r.venue))}
          roomOptions={uniq(tableRows.map((r) => r.room))}
          timeslotOptions={uniq(tableRows.map((r) => r.timeslot))}
        />
      </section>
    </div>
  );
}
