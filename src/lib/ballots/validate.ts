import type { ScoreConfig } from "@/db/schema";

export type SpeechInput = {
  position: number;
  speakerId: string | null;
  /** Score as entered (e.g. 75 or 75.5). */
  score: number | null;
  /** Duplicate / iron-person speech — speaker already spoke in another position. */
  ghost: boolean;
};

export type BallotSideInput = {
  teamId: string;
  speeches: SpeechInput[];
};

export type BallotInput = {
  affirmative: BallotSideInput;
  negative: BallotSideInput;
  /** Only used when totals tie and draws are disallowed, or for low-point wins. */
  winnerTeamId?: string | null;
};

export type BallotValidation = {
  ok: boolean;
  errors: string[];
  /** Field-level errors keyed by `${side}.${position}`. */
  fieldErrors: Record<string, string>;
  affTotal: number;
  negTotal: number;
  winnerTeamId: string | null;
  margin: number;
};

export function toHundredths(score: number): number {
  return Math.round(score * 100);
}

export function fromHundredths(value: number): number {
  return value / 100;
}

/**
 * Tabbycat-style ballot validation:
 * - every speech needs a speaker and a score inside [min, max] on the step;
 * - a speaker may only speak twice if the second speech is marked as a duplicate;
 * - totals decide the winner; ties need `allowDraws`; a declared winner with
 *   the lower total needs `allowLowPointWin`.
 */
export function validateBallot(input: BallotInput, config: ScoreConfig): BallotValidation {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const checkSide = (label: "affirmative" | "negative", side: BallotSideInput) => {
    if (side.speeches.length !== config.speakersPerTeam) {
      errors.push(`${label} needs ${config.speakersPerTeam} speeches`);
    }
    const seen = new Map<string, number>();
    let total = 0;
    for (const speech of side.speeches) {
      const key = `${label}.${speech.position}`;
      if (!speech.speakerId) {
        fieldErrors[key] = "Choose a speaker";
      } else {
        const count = (seen.get(speech.speakerId) ?? 0) + 1;
        seen.set(speech.speakerId, count);
        if (count > 1 && !speech.ghost) {
          fieldErrors[key] = "Speaker already spoke — mark as duplicate speech";
        }
      }
      if (speech.score == null || Number.isNaN(speech.score)) {
        fieldErrors[key] = fieldErrors[key] ?? "Enter a score";
        continue;
      }
      if (speech.score < config.min || speech.score > config.max) {
        fieldErrors[key] = `Score must be between ${config.min} and ${config.max}`;
      } else {
        const steps = (speech.score - config.min) / config.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-6) {
          fieldErrors[key] = `Score must be in steps of ${config.step}`;
        }
      }
      total += speech.score;
    }
    return total;
  };

  const affTotal = checkSide("affirmative", input.affirmative);
  const negTotal = checkSide("negative", input.negative);

  let winnerTeamId: string | null = null;
  if (Object.keys(fieldErrors).length === 0) {
    if (affTotal === negTotal) {
      if (!config.allowDraws) {
        if (!input.winnerTeamId) {
          errors.push("Totals are tied — scores must differ, or a winner must be chosen");
        } else if (!config.allowLowPointWin) {
          errors.push("Totals are tied and low-point wins are not allowed");
        } else {
          winnerTeamId = input.winnerTeamId;
        }
      }
    } else {
      const byScore = affTotal > negTotal ? input.affirmative.teamId : input.negative.teamId;
      if (input.winnerTeamId && input.winnerTeamId !== byScore) {
        if (config.allowLowPointWin) winnerTeamId = input.winnerTeamId;
        else errors.push("The team with the higher total must win (low-point wins are not allowed)");
      } else {
        winnerTeamId = byScore;
      }
    }
  }

  return {
    ok: errors.length === 0 && Object.keys(fieldErrors).length === 0,
    errors,
    fieldErrors,
    affTotal,
    negTotal,
    winnerTeamId,
    margin: Math.abs(affTotal - negTotal),
  };
}
