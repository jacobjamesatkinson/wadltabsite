export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  divisions,
  rooms,
  rounds,
  teams,
  timeslots,
  venues,
  adjudicatorAssignments,
  adjudicatorProfiles,
  user,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublicFilters } from "./filters";

export default async function PublicDrawPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const publishedRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = publishedRounds.map((r) => r.id);

  const [
    debateRows,
    venueRows,
    roomRows,
    slotRows,
    divisionRows,
    teamRows,
    competitions,
  ] = await Promise.all([
    publishedIds.length
      ? db.query.debates.findMany({
          where: (t, { inArray }) => inArray(t.roundId, publishedIds),
        })
      : Promise.resolve([]),
    db.select().from(venues),
    db.select().from(rooms),
    db.select().from(timeslots),
    db.select().from(divisions),
    db.select().from(teams),
    db.query.competitions.findMany(),
  ]);

  const showAdjs = competitions.some((c) => c.config.publicShowAdjudicators);
  const assignments = showAdjs
    ? await db.select().from(adjudicatorAssignments)
    : [];
  const profiles = showAdjs ? await db.select().from(adjudicatorProfiles) : [];
  const users = showAdjs ? await db.select().from(user) : [];
  const profileUser = new Map(
    profiles.map((p) => [p.id, users.find((u) => u.id === p.userId)?.name])
  );

  const institutionIdByTeam = new Map(teamRows.map((t) => [t.id, t.institutionId]));
  const institutions = await db.query.institutions.findMany();
    let filtered = debateRows;
  if (sp.venue) filtered = filtered.filter((d) => d.venueId === sp.venue);
  if (sp.division) filtered = filtered.filter((d) => d.divisionId === sp.division);
  if (sp.round) filtered = filtered.filter((d) => d.roundId === sp.round);
  if (sp.timeslot) filtered = filtered.filter((d) => d.timeslotId === sp.timeslot);
  if (sp.institution) {
    filtered = filtered.filter((d) => {
      const a = d.affirmativeTeamId
        ? institutionIdByTeam.get(d.affirmativeTeamId)
        : null;
      const n = d.negativeTeamId
        ? institutionIdByTeam.get(d.negativeTeamId)
        : null;
      return a === sp.institution || n === sp.institution;
    });
  }

  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const roundMap = new Map(publishedRounds.map((r) => [r.id, r]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d]));

  const view = sp.view === "venue" ? "venue" : "list";

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Public draw"
          description="Published debates only — no private or administrative data"
        />
        <div className="flex gap-2">
          <LinkButton href="/public/draw" size="sm" variant={view === "list" ? "default" : "outline"}>
            Full draw
          </LinkButton>
          <LinkButton
            href="/public/draw?view=venue"
            size="sm"
            variant={view === "venue" ? "default" : "outline"}
          >
            Venue timeslots
          </LinkButton>
          <LinkButton href="/login" size="sm" variant="ghost">
            Sign in
          </LinkButton>
        </div>
      </div>

      <PublicFilters
        venues={venueRows.map((v) => ({ id: v.id, name: v.name }))}
        institutions={institutions.map((i) => ({ id: i.id, name: i.name }))}
        divisions={divisionRows.map((d) => ({ id: d.id, name: d.name }))}
        rounds={publishedRounds.map((r) => ({ id: r.id, name: r.name }))}
        timeslots={slotRows.map((s) => ({ id: s.id, name: s.label }))}
        current={sp}
      />

      {view === "list" ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Timeslot</TableHead>
                <TableHead>Teams</TableHead>
                {showAdjs ? <TableHead>Adjudicators</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showAdjs ? 7 : 6}
                    className="text-muted-foreground"
                  >
                    No published debates match these filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{roundMap.get(d.roundId)?.name}</TableCell>
                    <TableCell>
                      {d.divisionId ? divMap.get(d.divisionId)?.name : "—"}
                    </TableCell>
                    <TableCell>
                      {d.venueId ? venueMap.get(d.venueId)?.name : "—"}
                    </TableCell>
                    <TableCell>
                      {d.roomId ? roomMap.get(d.roomId)?.identifier : "—"}
                    </TableCell>
                    <TableCell>
                      {d.timeslotId ? slotMap.get(d.timeslotId)?.label : "—"}
                    </TableCell>
                    <TableCell>
                      {d.affirmativeTeamName} vs {d.negativeTeamName}
                    </TableCell>
                    {showAdjs ? (
                      <TableCell className="text-xs">
                        {assignments
                          .filter((a) => a.debateId === d.id)
                          .map((a) => profileUser.get(a.adjudicatorId))
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-6">
          {venueRows.map((v) => {
            const venueDebates = filtered.filter((d) => d.venueId === v.id);
            if (venueDebates.length === 0 && sp.venue && sp.venue !== v.id) {
              return null;
            }
            const bySlot = new Map<string, typeof venueDebates>();
            for (const d of venueDebates) {
              const key = d.timeslotId ?? "none";
              const list = bySlot.get(key) ?? [];
              list.push(d);
              bySlot.set(key, list);
            }
            return (
              <section key={v.id} className="space-y-3">
                <h2 className="text-lg font-semibold">{v.name}</h2>
                {[...bySlot.entries()].map(([slotId, list]) => (
                  <div key={slotId} className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {slotMap.get(slotId)?.label ?? "Unscheduled"}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((d) => (
                        <div key={d.id} className="rounded-md border p-3 text-sm">
                          <p className="font-medium">
                            Room {d.roomId ? roomMap.get(d.roomId)?.identifier : "—"}
                          </p>
                          <p>
                            {d.affirmativeTeamName} vs {d.negativeTeamName}
                          </p>
                          {d.divisionId ? (
                            <p className="text-xs text-muted-foreground">
                              {divMap.get(d.divisionId)?.name}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {venueDebates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No debates at this venue</p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
