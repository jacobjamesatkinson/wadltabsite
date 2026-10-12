import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { byes, debates, drawVersions, rooms, timeslots } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DrawActions } from "./draw-actions";

export default async function DrawDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();

  const debateRows = await db.select().from(debates).where(eq(debates.roundId, roundId));
  const byeRows = await db.select().from(byes).where(eq(byes.roundId, roundId));
  const versions = await db
    .select()
    .from(drawVersions)
    .where(eq(drawVersions.roundId, roundId));
  const latest = versions.sort((a, b) => b.version - a.version)[0];
  const roomRows = await db.select().from(rooms);
  const slotRows = await db.select().from(timeslots).where(eq(timeslots.roundId, roundId));
  const roomMap = new Map(roomRows.map((r) => [r.id, r.identifier]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s.label]));

  const hard = (latest?.hardViolations as string[] | undefined) ?? [];
  const soft = (latest?.softWarnings as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Draw — ${round.name}`}
        description={`Status: ${round.drawStatus}`}
        actions={
          <DrawActions roundId={roundId} drawStatus={round.drawStatus} hasHard={hard.length > 0} />
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
          <AlertTitle>Pairing compromises / warnings</AlertTitle>
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
        <h2 className="text-sm font-semibold">Debates ({debateRows.length})</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affirmative</TableHead>
                <TableHead>Negative</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Timeslot</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debateRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No debates — generate a draft draw
                  </TableCell>
                </TableRow>
              ) : (
                debateRows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.affirmativeTeamName}</TableCell>
                    <TableCell>{d.negativeTeamName}</TableCell>
                    <TableCell>{d.roomId ? roomMap.get(d.roomId) : "—"}</TableCell>
                    <TableCell>{d.timeslotId ? slotMap.get(d.timeslotId) : "—"}</TableCell>
                    <TableCell className="space-x-1">
                      {d.isRematch ? <Badge variant="outline">Rematch</Badge> : null}
                      {d.isSameInstitution ? (
                        <Badge variant="outline">Same inst.</Badge>
                      ) : null}
                      {d.isPullUp ? <Badge variant="outline">Pull-up</Badge> : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Byes ({byeRows.length})</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Automatic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No byes
                  </TableCell>
                </TableRow>
              ) : (
                byeRows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.teamId}</TableCell>
                    <TableCell>{b.reason}</TableCell>
                    <TableCell>{b.automatic ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {latest ? (
        <p className="text-xs text-muted-foreground">
          Version {latest.version} ({latest.status}) · seed {latest.seed}
        </p>
      ) : null}
    </div>
  );
}
