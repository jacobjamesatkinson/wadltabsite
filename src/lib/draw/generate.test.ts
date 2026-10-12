import { describe, expect, it } from "vitest";
import { defaultCompetitionConfig } from "@/db/schema";
import { generateDraw } from "./generate";
import type { DrawTeam } from "./types";

function team(
  id: string,
  wins: number,
  institutionId = "inst1",
  byes = 0
): DrawTeam {
  return {
    id,
    name: `Team ${id}`,
    institutionId,
    divisionId: "div1",
    wins,
    losses: 0,
    byes,
    speakerPoints: wins * 10,
  };
}

describe("generateDraw", () => {
  it("pairs even number of teams without bye", () => {
    const result = generateDraw({
      teams: [team("a", 2), team("b", 2), team("c", 1), team("d", 1)],
      rooms: [
        { id: "r1", venueId: "v1", identifier: "1" },
        { id: "r2", venueId: "v1", identifier: "2" },
      ],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [],
      config: defaultCompetitionConfig,
      seed: "test-even",
    });
    expect(result.byes).toHaveLength(0);
    expect(result.debates).toHaveLength(2);
    expect(result.hardViolations).toHaveLength(0);
  });

  it("allocates bye for odd team count to lowest ranked without prior bye", () => {
    const result = generateDraw({
      teams: [team("a", 3), team("b", 2), team("c", 1), team("d", 0), team("e", 0)],
      rooms: [{ id: "r1", venueId: "v1", identifier: "1" }],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [],
      config: defaultCompetitionConfig,
      seed: "test-odd",
    });
    expect(result.byes).toHaveLength(1);
    expect(result.debates).toHaveLength(2);
    // lowest ranked among those without byes — e or d
    expect(["d", "e"]).toContain(result.byes[0]!.teamId);
  });

  it("avoids rematch when alternatives exist", () => {
    const result = generateDraw({
      teams: [team("a", 1), team("b", 1), team("c", 1), team("d", 1)],
      rooms: [
        { id: "r1", venueId: "v1", identifier: "1" },
        { id: "r2", venueId: "v1", identifier: "2" },
      ],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [{ teamAId: "a", teamBId: "b" }],
      config: defaultCompetitionConfig,
      seed: "test-rematch",
    });
    const rematch = result.debates.some(
      (d) =>
        (d.affirmativeTeamId === "a" && d.negativeTeamId === "b") ||
        (d.affirmativeTeamId === "b" && d.negativeTeamId === "a")
    );
    expect(rematch).toBe(false);
  });

  it("is deterministic for the same seed", () => {
    const input = {
      teams: [team("a", 2), team("b", 2, "inst2"), team("c", 1), team("d", 1, "inst2")],
      rooms: [
        { id: "r1", venueId: "v1", identifier: "1" },
        { id: "r2", venueId: "v1", identifier: "2" },
      ],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [],
      config: defaultCompetitionConfig,
      seed: "deterministic",
    };
    const a = generateDraw(input);
    const b = generateDraw(input);
    expect(a.debates).toEqual(b.debates);
    expect(a.byes).toEqual(b.byes);
  });

  it("never pairs a team against itself", () => {
    const result = generateDraw({
      teams: [team("a", 1), team("b", 1), team("c", 0)],
      rooms: [{ id: "r1", venueId: "v1", identifier: "1" }],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [],
      config: defaultCompetitionConfig,
      seed: "self",
    });
    for (const d of result.debates) {
      expect(d.affirmativeTeamId).not.toBe(d.negativeTeamId);
    }
  });

  it("warns on same-institution when unavoidable", () => {
    const result = generateDraw({
      teams: [
        team("a", 1, "same"),
        team("b", 1, "same"),
      ],
      rooms: [{ id: "r1", venueId: "v1", identifier: "1" }],
      timeslots: [{ id: "t1", label: "Slot 1", sortOrder: 0 }],
      priorMatches: [],
      config: defaultCompetitionConfig,
      seed: "same-inst",
    });
    expect(result.debates).toHaveLength(1);
    expect(result.debates[0]!.isSameInstitution).toBe(true);
    expect(result.softWarnings.some((w) => w.includes("Same institution"))).toBe(true);
  });
});
