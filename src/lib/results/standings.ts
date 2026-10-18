import type { CompetitionConfig } from "@/db/schema";

export type StandingRow = {
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  byes: number;
  speakerPoints: number;
  played: number;
};

export function computeStandings(
  teams: StandingRow[],
  config: CompetitionConfig
): StandingRow[] {
  return [...teams].sort((a, b) => {
    const aWins = config.bye.countsAsWin ? a.wins + a.byes : a.wins;
    const bWins = config.bye.countsAsWin ? b.wins + b.byes : b.wins;
    if (bWins !== aWins) return bWins - aWins;
    for (const tb of config.ranking.tiebreakers) {
      if (tb === "speaker_points" && b.speakerPoints !== a.speakerPoints) {
        return b.speakerPoints - a.speakerPoints;
      }
      if (tb === "team_name") return a.name.localeCompare(b.name);
    }
    return a.teamId.localeCompare(b.teamId);
  });
}