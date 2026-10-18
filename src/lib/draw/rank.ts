import type { CompetitionConfig, DrawOptions } from "@/db/schema";
import type { DrawTeam } from "./types";

/** Points used for bracketing — wins, optionally counting byes as wins. */
export function teamPoints(team: DrawTeam, options: Pick<DrawOptions, "byeCountsAsWin">) {
  return options.byeCountsAsWin ? team.wins + team.byes : team.wins;
}

export function compareTeams(
  a: DrawTeam,
  b: DrawTeam,
  config: CompetitionConfig,
  options: Pick<DrawOptions, "byeCountsAsWin"> = config.draw
): number {
  const pa = teamPoints(a, options);
  const pb = teamPoints(b, options);
  if (pb !== pa) return pb - pa;
  for (const tb of config.ranking.tiebreakers) {
    if (tb === "speaker_points" && b.speaks !== a.speaks) {
      return b.speaks - a.speaks;
    }
    if (tb === "team_name") {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
    }
    // margin / ballot_count are not tracked on the team snapshot.
  }
  if (b.drawStrengthWins !== a.drawStrengthWins) {
    return b.drawStrengthWins - a.drawStrengthWins;
  }
  return a.id.localeCompare(b.id);
}

export function rankTeams(
  teams: DrawTeam[],
  config: CompetitionConfig,
  options: Pick<DrawOptions, "byeCountsAsWin"> = config.draw
): DrawTeam[] {
  return [...teams].sort((a, b) => compareTeams(a, b, config, options));
}

/** Raw brackets: points -> teams, highest points first, teams ranked within. */
export function makeRawBrackets(
  teams: DrawTeam[],
  config: CompetitionConfig,
  options: Pick<DrawOptions, "byeCountsAsWin">
): Map<number, DrawTeam[]> {
  const ranked = rankTeams(teams, config, options);
  const brackets = new Map<number, DrawTeam[]>();
  for (const team of ranked) {
    const points = teamPoints(team, options);
    const list = brackets.get(points) ?? [];
    list.push(team);
    brackets.set(points, list);
  }
  return brackets;
}

export function timesMet(a: DrawTeam, b: DrawTeam): number {
  return a.history[b.id] ?? 0;
}

export function sameInstitution(a: DrawTeam, b: DrawTeam): boolean {
  return Boolean(a.institutionId) && a.institutionId === b.institutionId;
}
