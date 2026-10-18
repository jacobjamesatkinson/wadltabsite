import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { generateDraw } from "@/lib/draw";
import { loadDrawInput } from "@/lib/draw/load";
import { loadDrawView, type DrawView } from "@/lib/draw/view";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { RoundStepNav } from "../round-step-nav";
import { CreateDrawForm } from "./create-draw-form";
import { DrawActions } from "./draw-actions";
import { DrawFlags } from "./draw-flags";
import { DrawReportView, DrawStatsStrip } from "./draw-report";

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

  if (round.drawStatus === "none") {
    return <CreateDrawView roundId={roundId} roundName={round.name} />;
  }

  const view = await loadDrawView(roundId);
  return <ExistingDrawView view={view} />;
}

// ---------------------------------------------------------------------------

async function CreateDrawView({ roundId, roundName }: { roundId: string; roundName: string }) {
  const input = await loadDrawInput(roundId);
  // Dry run with the configured options to surface every problem before creating.
  const preview = generateDraw({ ...input, seed: "preflight" });
  const fatal = preview.report.issues.filter((i) => i.severity === "fatal");
  const onlyRoomIssues =
    fatal.length > 0 && fatal.every((i) => i.code === "room_shortfall" || i.code === "no_rooms_for_venue");

  const venueName = new Map(input.venues.map((v) => [v.id, v.name]));
  const slotLabel = new Map(input.timeslots.map((t) => [t.id, formatTimeslotTime(t.startsAt)]));
  const divisionName = new Map(input.divisions.map((d) => [d.id, d.name]));

  // Group summary: venue × timeslot × division
  const groupSummary = new Map<
    string,
    { venue: string; timeslot: string; division: string; teams: number; venueId: string; timeslotId: string }
  >();
  for (const t of input.teams) {
    if (!t.venueId || !t.timeslotId || !t.divisionId) continue;
    const key = `${t.venueId}|${t.timeslotId}|${t.divisionId}`;
    const g = groupSummary.get(key) ?? {
      venue: venueName.get(t.venueId) ?? "?",
      timeslot: slotLabel.get(t.timeslotId) ?? "?",
      division: divisionName.get(t.divisionId) ?? "?",
      teams: 0,
      venueId: t.venueId,
      timeslotId: t.timeslotId,
    };
    g.teams++;
    groupSummary.set(key, g);
  }
  const roomsByVenue = new Map<string, number>();
  for (const r of input.rooms) roomsByVenue.set(r.venueId, (roomsByVenue.get(r.venueId) ?? 0) + 1);
  const debatesByVenueSlot = new Map<string, number>();
  for (const g of groupSummary.values()) {
    const key = `${g.venueId}|${g.timeslotId}`;
    debatesByVenueSlot.set(key, (debatesByVenueSlot.get(key) ?? 0) + Math.floor(g.teams / 2));
  }

  const incompleteTeams = input.teams.filter((t) => !t.venueId || !t.timeslotId || !t.divisionId);

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={roundName} current="draw" />
      <PageHeader
        title="Create draw"
        description="Check the inputs below, choose how the draw should be generated, then create it. Teams are only ever paired with teams at the same venue, timeslot and division."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Inputs</h2>
          <div className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
            {[
              { label: "Teams in draw", value: input.teams.length },
              { label: "Unavailable", value: input.unavailableTeamIds.length },
              { label: "Groups", value: groupSummary.size },
              { label: "Rooms available", value: input.rooms.length },
            ].map((item) => (
              <div key={item.label} className="bg-background px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {groupSummary.size > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-right">Teams</TableHead>
                  <TableHead className="text-right">Rooms needed / have</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...groupSummary.values()]
                  .sort((a, b) => a.venue.localeCompare(b.venue) || a.timeslot.localeCompare(b.timeslot) || a.division.localeCompare(b.division))
                  .map((g) => {
                    const needed = debatesByVenueSlot.get(`${g.venueId}|${g.timeslotId}`) ?? 0;
                    const have = roomsByVenue.get(g.venueId) ?? 0;
                    const odd = g.teams % 2 === 1;
                    return (
                      <TableRow key={`${g.venueId}|${g.timeslotId}|${g.division}`}>
                        <TableCell>{g.venue}</TableCell>
                        <TableCell>{g.timeslot}</TableCell>
                        <TableCell>{g.division}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.teams}
                          {odd ? <span className="ml-1 text-xs text-muted-foreground">(bye)</span> : null}
                        </TableCell>
                        <TableCell className={have < needed ? "text-right font-medium text-destructive tabular-nums" : "text-right tabular-nums"}>
                          {needed} / {have}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No teams have a venue, timeslot and division yet.{" "}
              <Link href="/admin/teams" className="underline underline-offset-2">Assign them on the Teams page.</Link>
            </p>
          )}

          {incompleteTeams.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {incompleteTeams.length} team{incompleteTeams.length === 1 ? " is" : "s are"} missing a venue, timeslot or division and listed under “must fix”.
            </p>
          ) : null}

          <h2 className="pt-2 text-sm font-semibold">Preflight</h2>
          <DrawReportView report={preview.report} compact />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Options</h2>
          <CreateDrawForm
            roundId={roundId}
            roundNumber={input.roundNumber}
            defaults={input.config.draw}
            blocked={fatal.length > 0}
            onlyRoomIssues={onlyRoomIssues}
          />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ExistingDrawView({ view }: { view: DrawView }) {
  const { round } = view;
  const status = round.drawStatus as "draft" | "published";
  const incomplete = view.debates.filter((d) => !d.affirmative || !d.negative).length;
  const noRoom = view.debates.filter((d) => !d.roomId).length;
  const unfilledAdj = view.debates.filter((d) => d.adjudicators.length === 0).length;

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={round.id} roundName={round.name} current="draw" />
      <PageHeader
        title="Draw"
        description={
          status === "published"
            ? "This draw is released and visible to teams, coordinators and adjudicators."
            : "Draft draw. Edit matchups, allocate adjudicators, then release it."
        }
        actions={<DrawActions roundId={round.id} drawStatus={status} incompleteRooms={incomplete} />}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={status === "published" ? "default" : "secondary"} className="capitalize">
          {status === "published" ? "Released" : "Draft"}
        </Badge>
        {view.version ? (
          <span className="text-muted-foreground">
            {view.version.drawType.replace("_", "-")} draw
            {view.version.seed ? ` · seed ${view.version.seed}` : ""}
          </span>
        ) : null}
        {incomplete > 0 ? (
          <Link href={`/admin/rounds/${round.id}/matchups`} className="text-destructive underline underline-offset-2">
            {incomplete} room{incomplete === 1 ? "" : "s"} missing a team
          </Link>
        ) : null}
        {noRoom > 0 ? (
          <Link href={`/admin/rounds/${round.id}/matchups`} className="text-amber-700 underline underline-offset-2">
            {noRoom} debate{noRoom === 1 ? "" : "s"} without a room
          </Link>
        ) : null}
        {unfilledAdj > 0 ? (
          <Link href={`/admin/rounds/${round.id}/adjudicators`} className="text-amber-700 underline underline-offset-2">
            {unfilledAdj} debate{unfilledAdj === 1 ? "" : "s"} without an adjudicator
          </Link>
        ) : null}
        {view.unallocated.length > 0 ? (
          <Link href={`/admin/rounds/${round.id}/matchups`} className="text-amber-700 underline underline-offset-2">
            {view.unallocated.length} unallocated team{view.unallocated.length === 1 ? "" : "s"}
          </Link>
        ) : null}
      </div>

      {view.version?.report ? <DrawStatsStrip report={view.version.report} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {view.groups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {group.venueName}
                <span className="font-normal text-muted-foreground">{group.timeslotLabel}</span>
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {group.debates.length} debate{group.debates.length === 1 ? "" : "s"}
                </span>
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Room</TableHead>
                    <TableHead className="w-16 text-right">Bracket</TableHead>
                    <TableHead>Affirmative</TableHead>
                    <TableHead>Negative</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Adjudicator</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.debates.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className={d.roomLabel ? "" : "text-muted-foreground"}>{d.roomLabel || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{d.bracket ?? "—"}</TableCell>
                      <TableCell className={d.affirmative ? "" : "text-destructive"}>
                        {d.affirmative?.name ?? "Missing"}
                        {d.affirmative ? <span className="ml-1 text-xs text-muted-foreground">({d.affirmative.wins})</span> : null}
                      </TableCell>
                      <TableCell className={d.negative ? "" : "text-destructive"}>
                        {d.negative?.name ?? "Missing"}
                        {d.negative ? <span className="ml-1 text-xs text-muted-foreground">({d.negative.wins})</span> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.divisionName}</TableCell>
                      <TableCell className={d.adjudicators.length ? "" : "text-muted-foreground"}>
                        {d.adjudicators.map((a) => a.name).join(", ") || "Unallocated"}
                      </TableCell>
                      <TableCell>
                        <DrawFlags flags={d.flags} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}

          {view.byes.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Byes</h2>
              <ul className="divide-y border">
                {view.byes.map((b) => (
                  <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{b.team.name}</span>
                    <span className="text-xs text-muted-foreground">{b.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">Generation report</h2>
          {view.version?.report ? (
            <DrawReportView report={view.version.report} compact />
          ) : (
            <p className="text-sm text-muted-foreground">No report stored for this draw.</p>
          )}
          <Button variant="outline" className="w-full" render={<Link href={`/admin/rounds/${round.id}/display`} />}>
            Next: Display
          </Button>
        </aside>
      </div>
    </div>
  );
}
