import type { CompetitionConfig } from "@/db/schema";
import type { DrawTeam } from "./types";

export function compareTeams(
  a: DrawTeam,
  b: DrawTeam,
  config: CompetitionConfig
): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  for (const tb of config.ranking.tiebreakers) {
    if (tb === "speaker_points" && b.speakerPoints !== a.speakerPoints) {
      return b.speakerPoints - a.speakerPoints;
    }
    if (tb === "team_name") {
      return a.name.localeCompare(b.name);
    }
    if (tb === "margin") {
      // margin not tracked on team snapshot yet; skip
      continue;
    }
    if (tb === "ballot_count") {
      continue;
    }
  }
  return a.id.localeCompare(b.id);
}

export function rankTeams(teams: DrawTeam[], config: CompetitionConfig): DrawTeam[] {
  return [...teams].sort((a, b) => compareTeams(a, b, config));
}

export function groupByWins(teams: DrawTeam[]): Map<number, DrawTeam[]> {
  const map = new Map<number, DrawTeam[]>();
  for (const t of teams) {
    const list = map.get(t.wins) ?? [];
    list.push(t);
    map.set(t.wins, list);
  }
  return map;
}
