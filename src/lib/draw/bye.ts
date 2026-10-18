import type { CompetitionConfig, DrawOptions } from "@/db/schema";
import { rankTeams } from "./rank";
import type { DrawIssue, DrawTeam, GeneratedBye, GroupKey, Rng } from "./types";

/**
 * Odd group → bye to the lowest-ranked team with the fewest prior byes.
 * Ties broken by rank (lowest first), then randomly.
 */
export function allocateBye(
  teams: DrawTeam[],
  key: GroupKey,
  config: CompetitionConfig,
  options: DrawOptions,
  rng: Rng,
  labels: { venue: string; timeslot: string; division: string }
): { remaining: DrawTeam[]; bye: GeneratedBye | null; issues: DrawIssue[] } {
  if (teams.length % 2 === 0) return { remaining: teams, bye: null, issues: [] };

  const issues: DrawIssue[] = [];
  const ranked = rankTeams(teams, config, options);
  const minByes = Math.min(...ranked.map((t) => t.byes));
  const candidates = ranked.filter((t) => t.byes === minByes);
  // Lowest ranked among candidates; equal-ranked ties randomised.
  const lowest = candidates[candidates.length - 1]!;
  const tied = candidates.filter(
    (t) => t.wins === lowest.wins && t.speaks === lowest.speaks && t.byes === lowest.byes
  );
  const chosen = tied.length > 1 ? tied[Math.floor(rng() * tied.length)]! : lowest;

  const where = `${labels.venue} · ${labels.timeslot} · ${labels.division}`;
  if (chosen.byes > 0) {
    issues.push({
      code: "second_bye",
      severity: "warning",
      message: `${chosen.name} receives a second bye (${where}) — every team in this group has already had one`,
      teamIds: [chosen.id],
      ...key,
    });
  } else {
    issues.push({
      code: "odd_group_bye",
      severity: "info",
      message: `${chosen.name} receives the bye (${where}: ${teams.length} teams)`,
      teamIds: [chosen.id],
      ...key,
    });
  }

  return {
    remaining: teams.filter((t) => t.id !== chosen.id),
    bye: {
      teamId: chosen.id,
      teamName: chosen.name,
      group: key,
      reason:
        chosen.byes > 0
          ? "Odd number of teams; second bye (no team without a prior bye)"
          : "Odd number of teams; lowest-ranked team without a prior bye",
      automatic: true,
    },
    issues,
  };
}
