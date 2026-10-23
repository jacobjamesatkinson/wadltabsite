import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  byes,
  competitionTimeslots,
  debates,
  divisions,
  drawVersions,
  institutions,
  rooms,
  teamAvailability,
  teams,
  user,
  venues,
  type DebateFlag,
} from "@/db/schema";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import type { DrawReport } from "./types";

export type DrawViewTeam = {
  id: string;
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  venueId: string | null;
  timeslotId: string | null;
  divisionId: string | null;
  wins: number;
  losses: number;
  byes: number;
  speaks: number;
};

export type DrawViewDebate = {
  id: string;
  venueId: string | null;
  venueName: string;
  timeslotId: string | null;
  timeslotLabel: string;
  divisionId: string | null;
  divisionName: string;
  divisionSort: number;
  divisionChipColor: string | null;
  roomId: string | null;
  roomLabel: string;
  bracket: number | null;
  roomRank: number;
  flags: DebateFlag[];
  affirmative: DrawViewTeam | null;
  negative: DrawViewTeam | null;
  adjudicators: Array<{ assignmentId: string; id: string; name: string; role: string }>;
  status: string;
};

export type DrawViewGroup = {
  key: string;
  venueId: string;
  venueName: string;
  timeslotId: string;
  timeslotLabel: string;
  debates: DrawViewDebate[];
};

export type DrawView = {
  round: { id: string; name: string; number: number; drawStatus: "none" | "draft" | "published" };
  version: { id: string; drawType: string; seed: string | null; report: DrawReport | null } | null;
  groups: DrawViewGroup[];
  debates: DrawViewDebate[];
  byes: Array<{ id: string; team: DrawViewTeam; reason: string; automatic: boolean }>;
  /** Active, available teams not in any debate or bye. */
  unallocated: DrawViewTeam[];
  teams: DrawViewTeam[];
  venues: Array<{ id: string; name: string; rooms: Array<{ id: string; identifier: string }> }>;
  timeslots: Array<{ id: string; label: string; sortOrder: number }>;
  divisions: Array<{
    id: string;
    name: string;
    sortOrder: number;
    chipColor: string | null;
  }>;
};

export async function loadDrawView(roundId: string): Promise<DrawView> {
  const round = await db.query.rounds.findFirst({ where: (t, { eq: e }) => e(t.id, roundId) });
  if (!round) throw new Error("NOT_FOUND");

  const [
    debateRows,
    byeRows,
    versionRows,
    teamRows,
    teamAvail,
    institutionRows,
    venueRows,
    roomRows,
    slotRows,
    divisionRows,
    profiles,
    users,
  ] = await Promise.all([
    db.select().from(debates).where(eq(debates.roundId, roundId)),
    db.select().from(byes).where(eq(byes.roundId, roundId)),
    db.select().from(drawVersions).where(eq(drawVersions.roundId, roundId)),
    db
      .select()
      .from(teams)
      .where(and(eq(teams.competitionId, round.competitionId), eq(teams.status, "active"))),
    db.select().from(teamAvailability).where(eq(teamAvailability.roundId, roundId)),
    db.select().from(institutions),
    db.select().from(venues).where(eq(venues.status, "active")),
    db.select().from(rooms),
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, round.competitionId))
      .orderBy(asc(competitionTimeslots.sortOrder), asc(competitionTimeslots.startsAt)),
    db.select().from(divisions).where(eq(divisions.competitionId, round.competitionId)),
    db.select().from(adjudicatorProfiles),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);

  const debateIds = debateRows.map((d) => d.id);
  const assignmentRows = debateIds.length
    ? await db
        .select()
        .from(adjudicatorAssignments)
        .where(inArray(adjudicatorAssignments.debateId, debateIds))
    : [];

  const institutionMap = new Map(institutionRows.map((i) => [i.id, i]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const divisionMap = new Map(divisionRows.map((d) => [d.id, d]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(profiles.map((p) => [p.id, userName.get(p.userId) ?? p.id]));

  const viewTeams: DrawViewTeam[] = teamRows.map((t) => {
    const inst = t.institutionId ? institutionMap.get(t.institutionId) : null;
    return {
      id: t.id,
      name: formatTeamDisplayName(t, inst),
      institutionId: t.institutionId,
      institutionName: inst?.name ?? null,
      venueId: t.venueId,
      timeslotId: t.timeslotId,
      divisionId: t.divisionId,
      wins: t.wins,
      losses: t.losses,
      byes: t.byes,
      speaks: t.speakerPoints,
    };
  });
  const teamMap = new Map(viewTeams.map((t) => [t.id, t]));

  const adjsByDebate = new Map<string, DrawViewDebate["adjudicators"]>();
  for (const a of assignmentRows) {
    const list = adjsByDebate.get(a.debateId) ?? [];
    list.push({
      assignmentId: a.id,
      id: a.adjudicatorId,
      name: adjName.get(a.adjudicatorId) ?? a.adjudicatorId,
      role: a.role,
    });
    adjsByDebate.set(a.debateId, list);
  }

  const slotLabel = (id: string | null) => {
    const s = id ? slotMap.get(id) : null;
    return s ? formatTimeslotTime(s.startsAt) : "No timeslot";
  };

  const viewDebates: DrawViewDebate[] = debateRows.map((d) => ({
    id: d.id,
    venueId: d.venueId,
    venueName: d.venueId ? venueMap.get(d.venueId)?.name ?? "Unknown venue" : "No venue",
    timeslotId: d.timeslotId,
    timeslotLabel: slotLabel(d.timeslotId),
    divisionId: d.divisionId,
    divisionName: d.divisionId
      ? divisionMap.get(d.divisionId)?.name ?? "—"
      : "—",
    divisionSort: d.divisionId
      ? (divisionMap.get(d.divisionId)?.sortOrder ?? 999)
      : 999,
    divisionChipColor: d.divisionId
      ? (divisionMap.get(d.divisionId)?.chipColor ?? null)
      : null,
    roomId: d.roomId,
    roomLabel: d.roomId ? roomMap.get(d.roomId)?.identifier ?? "?" : "",
    bracket: d.bracket,
    roomRank: d.roomRank ?? 0,
    flags: (d.flags ?? []) as DebateFlag[],
    affirmative: d.affirmativeTeamId
      ? teamMap.get(d.affirmativeTeamId) ?? {
          id: d.affirmativeTeamId,
          name: d.affirmativeTeamName ?? "Team",
          institutionId: null,
          institutionName: null,
          venueId: d.venueId,
          timeslotId: d.timeslotId,
          divisionId: d.divisionId,
          wins: 0,
          losses: 0,
          byes: 0,
          speaks: 0,
        }
      : null,
    negative: d.negativeTeamId
      ? teamMap.get(d.negativeTeamId) ?? {
          id: d.negativeTeamId,
          name: d.negativeTeamName ?? "Team",
          institutionId: null,
          institutionName: null,
          venueId: d.venueId,
          timeslotId: d.timeslotId,
          divisionId: d.divisionId,
          wins: 0,
          losses: 0,
          byes: 0,
          speaks: 0,
        }
      : null,
    adjudicators: adjsByDebate.get(d.id) ?? [],
    status: d.status,
  }));

  const groupMap = new Map<string, DrawViewGroup>();
  for (const d of viewDebates) {
    const key = `${d.venueId ?? "none"}|${d.timeslotId ?? "none"}`;
    const g = groupMap.get(key) ?? {
      key,
      venueId: d.venueId ?? "",
      venueName: d.venueName,
      timeslotId: d.timeslotId ?? "",
      timeslotLabel: d.timeslotLabel,
      debates: [],
    };
    g.debates.push(d);
    groupMap.set(key, g);
  }
  const groups = [...groupMap.values()].sort(
    (a, b) =>
      a.venueName.localeCompare(b.venueName) ||
      (slotMap.get(a.timeslotId)?.sortOrder ?? 0) - (slotMap.get(b.timeslotId)?.sortOrder ?? 0)
  );
  for (const g of groups) {
    g.debates.sort(
      (a, b) =>
        (b.bracket ?? 0) - (a.bracket ?? 0) ||
        a.roomRank - b.roomRank ||
        a.roomLabel.localeCompare(b.roomLabel, undefined, { numeric: true })
    );
  }

  const placed = new Set<string>();
  for (const d of debateRows) {
    if (d.affirmativeTeamId) placed.add(d.affirmativeTeamId);
    if (d.negativeTeamId) placed.add(d.negativeTeamId);
  }
  const byeView = byeRows
    .map((b) => {
      const team = teamMap.get(b.teamId);
      if (!team) return null;
      placed.add(b.teamId);
      return { id: b.id, team, reason: b.reason, automatic: b.automatic };
    })
    .filter(Boolean) as DrawView["byes"];

  const unavailable = new Set(teamAvail.filter((a) => !a.available).map((a) => a.teamId));
  const unallocated = viewTeams
    .filter((t) => !placed.has(t.id) && !unavailable.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const version = [...versionRows].sort((a, b) => b.version - a.version)[0] ?? null;
  const snapshot = (version?.snapshot ?? null) as { report?: DrawReport } | null;

  return {
    round: { id: round.id, name: round.name, number: round.number, drawStatus: round.drawStatus },
    version: version
      ? { id: version.id, drawType: version.drawType, seed: version.seed, report: snapshot?.report ?? null }
      : null,
    groups,
    debates: viewDebates,
    byes: byeView,
    unallocated,
    teams: viewTeams,
    venues: venueRows
      .map((v) => ({
        id: v.id,
        name: v.name,
        rooms: roomRows
          .filter((r) => r.venueId === v.id)
          .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
          .map((r) => ({ id: r.id, identifier: r.identifier })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    timeslots: slotRows.map((s) => ({ id: s.id, label: formatTimeslotTime(s.startsAt), sortOrder: s.sortOrder })),
    divisions: [...divisionRows]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
        chipColor: d.chipColor,
      })),
  };
}
