import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  competitionTimeslots,
  divisions,
  institutions,
  speakers,
  teams,
  venues,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";
import {
  compareTeamNames,
  formatTeamDisplayName,
} from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import {
  CoordinatorTeamsTable,
  type CoordinatorTeamRow,
} from "./coordinator-teams-table";

export default async function CoordinatorTeamsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const [teamRows, institutionRows, divisionRows, venueRows, slotRows] =
    await Promise.all([
      ids.length > 0
        ? db.select().from(teams).where(inArray(teams.institutionId, ids))
        : Promise.resolve([]),
      ids.length > 0
        ? db.select().from(institutions).where(inArray(institutions.id, ids))
        : Promise.resolve([]),
      db.select().from(divisions),
      db.select().from(venues),
      db.select().from(competitionTimeslots),
    ]);

  const instMap = new Map(institutionRows.map((i) => [i.id, i]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v.name]));
  const slotMap = new Map(
    slotRows.map((s) => [s.id, formatTimeslotTime(s.startsAt)])
  );
  const teamIds = teamRows.map((t) => t.id);
  const speakerRows =
    teamIds.length > 0
      ? await db.select().from(speakers).where(inArray(speakers.teamId, teamIds))
      : [];
  const speakerCount = new Map<string, number>();
  for (const s of speakerRows) {
    speakerCount.set(s.teamId, (speakerCount.get(s.teamId) ?? 0) + 1);
  }

  const rows: CoordinatorTeamRow[] = teamRows
    .map((t) => {
      const institution = t.institutionId
        ? instMap.get(t.institutionId)
        : null;
      return {
        id: t.id,
        name: formatTeamDisplayName(t, institution ?? null),
        identifier: t.identifier,
        institution: institution?.name ?? "—",
        division: t.divisionId
          ? (divMap.get(t.divisionId)?.name ?? "—")
          : "—",
        divisionSort: t.divisionId
          ? (divMap.get(t.divisionId)?.sortOrder ?? 999)
          : 999,
        divisionChipColor: t.divisionId
          ? (divMap.get(t.divisionId)?.chipColor ?? null)
          : null,
        venue: t.venueId ? (venueMap.get(t.venueId) ?? "—") : "—",
        timeslot: t.timeslotId ? (slotMap.get(t.timeslotId) ?? "—") : "—",
        record: `${t.wins}–${t.losses}`,
        speakers: speakerCount.get(t.id) ?? 0,
        status: t.status,
      };
    })
    .sort((a, b) => compareTeamNames(a.name, b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My teams"
        description="Teams at your institutions — open a team to manage speakers"
      />
      {rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No teams at your institutions yet
        </div>
      ) : (
        <CoordinatorTeamsTable rows={rows} />
      )}
    </div>
  );
}
