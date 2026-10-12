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

export function applyAcceptedBallot(params: {
  affirmativeTeamId: string;
  negativeTeamId: string;
  winnerTeamId: string;
  affirmativePoints: number;
  negativePoints: number;
  teams: Map<string, StandingRow>;
}): void {
  const { teams, winnerTeamId, affirmativeTeamId, negativeTeamId } = params;
  const aff = teams.get(affirmativeTeamId);
  const neg = teams.get(negativeTeamId);
  if (!aff || !neg) return;

  aff.speakerPoints += params.affirmativePoints;
  neg.speakerPoints += params.negativePoints;
  aff.played += 1;
  neg.played += 1;

  if (winnerTeamId === affirmativeTeamId) {
    aff.wins += 1;
    neg.losses += 1;
  } else if (winnerTeamId === negativeTeamId) {
    neg.wins += 1;
    aff.losses += 1;
  }
}
