import { describe, expect, it } from "vitest";
import { defaultScoreConfig } from "@/db/schema";
import { validateBallot } from "./validate";

const side = (teamId: string, scores: Array<number | null>, speakers = ["s1", "s2", "s3"]) => ({
  teamId,
  speeches: scores.map((score, i) => ({ position: i + 1, speakerId: speakers[i] ?? null, score, ghost: false })),
});

describe("validateBallot", () => {
  it("derives the winner from totals", () => {
    const v = validateBallot(
      { affirmative: side("aff", [75, 76, 77]), negative: side("neg", [74, 75, 76], ["n1", "n2", "n3"]) },
      defaultScoreConfig
    );
    expect(v.ok).toBe(true);
    expect(v.winnerTeamId).toBe("aff");
    expect(v.margin).toBe(3);
  });

  it("rejects out-of-range and off-step scores", () => {
    const v = validateBallot(
      { affirmative: side("aff", [60, 75.5, 77]), negative: side("neg", [74, 75, 76], ["n1", "n2", "n3"]) },
      defaultScoreConfig
    );
    expect(v.ok).toBe(false);
    expect(v.fieldErrors["affirmative.1"]).toMatch(/between/);
    expect(v.fieldErrors["affirmative.2"]).toMatch(/steps/);
  });

  it("requires duplicate speeches to be marked", () => {
    const v = validateBallot(
      { affirmative: side("aff", [75, 75, 75], ["s1", "s1", "s2"]), negative: side("neg", [74, 74, 74], ["n1", "n2", "n3"]) },
      defaultScoreConfig
    );
    expect(v.fieldErrors["affirmative.2"]).toMatch(/duplicate/);
    const marked = {
      affirmative: {
        teamId: "aff",
        speeches: [
          { position: 1, speakerId: "s1", score: 75, ghost: false },
          { position: 2, speakerId: "s1", score: 75, ghost: true },
          { position: 3, speakerId: "s2", score: 75, ghost: false },
        ],
      },
      negative: side("neg", [74, 74, 74], ["n1", "n2", "n3"]),
    };
    expect(validateBallot(marked, defaultScoreConfig).ok).toBe(true);
  });

  it("rejects ties unless draws are allowed", () => {
    const tie = { affirmative: side("aff", [75, 75, 75]), negative: side("neg", [75, 75, 75], ["n1", "n2", "n3"]) };
    expect(validateBallot(tie, defaultScoreConfig).ok).toBe(false);
    expect(validateBallot(tie, { ...defaultScoreConfig, allowDraws: true }).ok).toBe(true);
  });

  it("rejects low-point wins unless allowed", () => {
    const input = {
      affirmative: side("aff", [75, 75, 75]),
      negative: side("neg", [74, 74, 74], ["n1", "n2", "n3"]),
      winnerTeamId: "neg",
    };
    expect(validateBallot(input, defaultScoreConfig).ok).toBe(false);
    const v = validateBallot(input, { ...defaultScoreConfig, allowLowPointWin: true });
    expect(v.ok).toBe(true);
    expect(v.winnerTeamId).toBe("neg");
  });
});
