import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorAvailability,
  adjudicatorConflicts,
  adjudicatorProfiles,
  competitionTimeslots,
  debates,
  institutionMemberships,
  institutions,
  normalizeCompetitionConfig,
  rooms,
  rounds,
  teams,
  user,
  userRoles,
  venues,
} from "@/db/schema";
import type { AdjCandidate, DebateForAllocation } from "./allocate";

export type AllocationTimeslot = { id: string; startsAt: string; sortOrder: number };

export type AllocationAssignment = {
  id: string;
  adjudicatorId: string;
  adjudicatorName: string;
  role: string;
};

export type AllocationCell = {
  debateId: string;
  roomId: string | null;
  roomLabel: string;
  timeslotId: string | null;
  affirmative: string | null;
  negative: string | null;
  affirmativeTeamId: string | null;
  negativeTeamId: string | null;
  institutionIds: string[];
  bracket: number;
  assignments: AllocationAssignment[];
};

export type AllocationVenue = {
  id: string;
  name: string;
  rosterDay: string | null;
  rooms: Array<{ id: string; identifier: string }>;
  cells: AllocationCell[];
};

export type AllocationAdjudicator = {
  id: string;
  name: string;
  /** Adjudicator's own school(s), if any. */
  ownInstitutionIds: string[];
  ownInstitutionNames: string[];
  conflictInstitutionIds: string[];
  conflictTeamIds: string[];
  unavailableTimeslotIds: string[];
  /** timeslotId -> debateId (where they're judging in this round). */
  placements: Record<string, { debateId: string; venueId: string | null; roomLabel: string }>;
  totalAssignments: number;
};

export type AllocationData = {
  round: typeof rounds.$inferSelect;
  panelSize: number;
  timeslots: AllocationTimeslot[];
  venues: AllocationVenue[];
  adjudicators: AllocationAdjudicator[];
};

export async function loadAllocationData(roundId: string): Promise<AllocationData> {
  const round = await db.query.rounds.findFirst({ where: (t, { eq: e }) => e(t.id, roundId) });
  if (!round) throw new Error("NOT_FOUND");
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");
  const config = normalizeCompetitionConfig(competition.config);

  const debateRows = await db.select().from(debates).where(eq(debates.roundId, roundId));
  const debateIds = debateRows.map((d) => d.id);

  const [
    slotRows,
    venueRows,
    roomRows,
    teamRows,
    profiles,
    users,
    conflicts,
    memberships,
    roleRows,
    institutionRows,
    availRows,
    assignmentRows,
    allAssignments,
  ] = await Promise.all([
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id))
      .orderBy(asc(competitionTimeslots.sortOrder), asc(competitionTimeslots.startsAt)),
    db.select().from(venues).where(eq(venues.status, "active")),
    db.select().from(rooms),
    db.select().from(teams),
    db.select().from(adjudicatorProfiles).where(eq(adjudicatorProfiles.active, true)),
    db.select({ id: user.id, name: user.name }).from(user),
    db.select().from(adjudicatorConflicts),
    db.select().from(institutionMemberships),
    db.select().from(userRoles),
    db.select().from(institutions),
    db.select().from(adjudicatorAvailability).where(eq(adjudicatorAvailability.roundId, roundId)),
    debateIds.length
      ? db.select().from(adjudicatorAssignments).where(inArray(adjudicatorAssignments.debateId, debateIds))
      : Promise.resolve([]),
    db.select({ adjudicatorId: adjudicatorAssignments.adjudicatorId }).from(adjudicatorAssignments),
  ]);

  const userName = new Map(users.map((u) => [u.id, u.name]));
  const teamMap = new Map(teamRows.map((t) => [t.id, t]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const institutionName = new Map(institutionRows.map((i) => [i.id, i.name]));
  const profileName = new Map(profiles.map((p) => [p.id, userName.get(p.userId) ?? p.id]));

  const assignmentsByDebate = new Map<string, AllocationAssignment[]>();
  for (const a of assignmentRows) {
    const list = assignmentsByDebate.get(a.debateId) ?? [];
    list.push({
      id: a.id,
      adjudicatorId: a.adjudicatorId,
      adjudicatorName: profileName.get(a.adjudicatorId) ?? a.adjudicatorId,
      role: a.role,
    });
    assignmentsByDebate.set(a.debateId, list);
  }

  const cellFor = (d: typeof debates.$inferSelect): AllocationCell => {
    const room = d.roomId ? roomMap.get(d.roomId) : null;
    const aff = d.affirmativeTeamId ? teamMap.get(d.affirmativeTeamId) : null;
    const neg = d.negativeTeamId ? teamMap.get(d.negativeTeamId) : null;
    return {
      debateId: d.id,
      roomId: d.roomId,
      roomLabel: room?.identifier ?? "No room",
      timeslotId: d.timeslotId,
      affirmative: d.affirmativeTeamName,
      negative: d.negativeTeamName,
      affirmativeTeamId: d.affirmativeTeamId,
      negativeTeamId: d.negativeTeamId,
      institutionIds: [aff?.institutionId, neg?.institutionId].filter(Boolean) as string[],
      bracket: d.bracket ?? 0,
      assignments: assignmentsByDebate.get(d.id) ?? [],
    };
  };

  const venueList: AllocationVenue[] = venueRows
    .map((v) => {
      const cells = debateRows.filter((d) => d.venueId === v.id).map(cellFor);
      const venueRooms = roomRows
        .filter((r) => r.venueId === v.id)
        .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
        .map((r) => ({ id: r.id, identifier: r.identifier }));
      return { id: v.id, name: v.name, rosterDay: v.rosterDay, rooms: venueRooms, cells };
    })
    .filter((v) => v.cells.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalCount = new Map<string, number>();
  for (const a of allAssignments) {
    totalCount.set(a.adjudicatorId, (totalCount.get(a.adjudicatorId) ?? 0) + 1);
  }

  const adjudicators: AllocationAdjudicator[] = profiles
    .map((p) => {
      const own = new Set<string>();
      for (const m of memberships) if (m.userId === p.userId) own.add(m.institutionId);
      for (const r of roleRows) if (r.userId === p.userId && r.institutionId) own.add(r.institutionId);
      const myConflicts = conflicts.filter((c) => c.adjudicatorId === p.id);
      const placements: AllocationAdjudicator["placements"] = {};
      for (const a of assignmentRows) {
        if (a.adjudicatorId !== p.id) continue;
        const d = debateRows.find((x) => x.id === a.debateId);
        if (!d?.timeslotId) continue;
        placements[d.timeslotId] = {
          debateId: d.id,
          venueId: d.venueId,
          roomLabel: d.roomId ? roomMap.get(d.roomId)?.identifier ?? "?" : "No room",
        };
      }
      return {
        id: p.id,
        name: userName.get(p.userId) ?? p.id,
        ownInstitutionIds: [...own],
        ownInstitutionNames: [...own].map((id) => institutionName.get(id) ?? id),
        conflictInstitutionIds: myConflicts.map((c) => c.institutionId).filter(Boolean) as string[],
        conflictTeamIds: myConflicts.map((c) => c.teamId).filter(Boolean) as string[],
        unavailableTimeslotIds: availRows
          .filter((a) => a.adjudicatorId === p.id && !a.available)
          .map((a) => a.timeslotId),
        placements,
        totalAssignments: totalCount.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    round,
    panelSize: config.panelSize,
    timeslots: slotRows.map((s) => ({ id: s.id, startsAt: s.startsAt, sortOrder: s.sortOrder })),
    venues: venueList,
    adjudicators,
  };
}

export function toCandidates(data: AllocationData): AdjCandidate[] {
  return data.adjudicators.map((a) => ({
    id: a.id,
    userId: "",
    name: a.name,
    assignmentCount: a.totalAssignments,
    conflictInstitutionIds: a.conflictInstitutionIds,
    conflictTeamIds: a.conflictTeamIds,
    ownInstitutionIds: a.ownInstitutionIds,
    unavailableTimeslotIds: new Set(a.unavailableTimeslotIds),
    lockedTimeslotIds: new Set(Object.keys(a.placements)),
  }));
}

export function toDebatesForAllocation(venue: AllocationVenue): DebateForAllocation[] {
  return venue.cells.map((c) => ({
    id: c.debateId,
    venueId: venue.id,
    timeslotId: c.timeslotId,
    affirmativeTeamId: c.affirmativeTeamId,
    negativeTeamId: c.negativeTeamId,
    institutionIds: c.institutionIds,
    bracket: c.bracket,
    currentAssignmentCount: c.assignments.length,
  }));
}
