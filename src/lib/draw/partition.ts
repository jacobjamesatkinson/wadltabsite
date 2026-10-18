import type {
  DrawDivision,
  DrawIssue,
  DrawTeam,
  DrawTimeslot,
  DrawVenue,
  GroupKey,
} from "./types";
import { groupKeyString } from "./types";

export type TeamGroup = {
  key: GroupKey;
  teams: DrawTeam[];
};

export type PartitionResult = {
  groups: TeamGroup[];
  issues: DrawIssue[];
};

/**
 * Teams are only ever paired within the same venue, timeslot and division.
 * Teams missing any of those are reported as fatal issues and excluded.
 */
export function partitionTeams(
  teams: DrawTeam[],
  venues: DrawVenue[],
  timeslots: DrawTimeslot[],
  divisions: DrawDivision[]
): PartitionResult {
  const issues: DrawIssue[] = [];
  const groups = new Map<string, TeamGroup>();
  const seen = new Set<string>();

  const venueIds = new Set(venues.map((v) => v.id));
  const slotIds = new Set(timeslots.map((t) => t.id));
  const divisionIds = new Set(divisions.map((d) => d.id));

  for (const team of teams) {
    if (seen.has(team.id)) {
      issues.push({
        code: "duplicate_team",
        severity: "fatal",
        message: `${team.name} appears more than once in the team list`,
        teamIds: [team.id],
      });
      continue;
    }
    seen.add(team.id);

    let valid = true;
    if (!team.venueId || !venueIds.has(team.venueId)) {
      valid = false;
      issues.push({
        code: "team_missing_venue",
        severity: "fatal",
        message: `${team.name} has no venue assigned`,
        teamIds: [team.id],
        fixHref: `/admin/teams/${team.id}`,
      });
    }
    if (!team.timeslotId || !slotIds.has(team.timeslotId)) {
      valid = false;
      issues.push({
        code: "team_missing_timeslot",
        severity: "fatal",
        message: `${team.name} has no timeslot assigned`,
        teamIds: [team.id],
        fixHref: `/admin/teams/${team.id}`,
      });
    }
    if (!team.divisionId || !divisionIds.has(team.divisionId)) {
      valid = false;
      issues.push({
        code: "team_missing_division",
        severity: "fatal",
        message: `${team.name} has no division assigned`,
        teamIds: [team.id],
        fixHref: `/admin/teams/${team.id}`,
      });
    }
    if (!valid) continue;

    const key: GroupKey = {
      venueId: team.venueId!,
      timeslotId: team.timeslotId!,
      divisionId: team.divisionId!,
    };
    const id = groupKeyString(key);
    const group = groups.get(id) ?? { key, teams: [] };
    group.teams.push(team);
    groups.set(id, group);
  }

  if (teams.length === 0) {
    issues.push({
      code: "no_teams",
      severity: "fatal",
      message: "No active, available teams to draw",
      fixHref: "/admin/teams",
    });
  }

  const venueOrder = new Map(venues.map((v, i) => [v.id, i]));
  const slotOrder = new Map(timeslots.map((t) => [t.id, t.sortOrder]));
  const divisionOrder = new Map(divisions.map((d, i) => [d.id, i]));

  const ordered = [...groups.values()].sort((a, b) => {
    const v = (venueOrder.get(a.key.venueId) ?? 0) - (venueOrder.get(b.key.venueId) ?? 0);
    if (v !== 0) return v;
    const s =
      (slotOrder.get(a.key.timeslotId) ?? 0) - (slotOrder.get(b.key.timeslotId) ?? 0);
    if (s !== 0) return s;
    return (
      (divisionOrder.get(a.key.divisionId) ?? 0) -
      (divisionOrder.get(b.key.divisionId) ?? 0)
    );
  });

  return { groups: ordered, issues };
}
