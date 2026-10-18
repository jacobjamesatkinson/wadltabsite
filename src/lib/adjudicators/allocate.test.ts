import { describe, expect, it } from "vitest";
import { defaultCompetitionConfig } from "@/db/schema";
import { allocateAdjudicators, checkEligibility, type AdjCandidate } from "./allocate";

function adj(id: string, overrides: Partial<AdjCandidate> = {}): AdjCandidate {
  return {
    id,
    userId: `u-${id}`,
    name: id,
    assignmentCount: 0,
    conflictInstitutionIds: [],
    conflictTeamIds: [],
    ownInstitutionIds: [],
    unavailableTimeslotIds: new Set(),
    lockedTimeslotIds: new Set(),
    ...overrides,
  };
}

const debate = (id: string, timeslotId: string, institutionIds: string[] = []) => ({
  id,
  venueId: "v1",
  timeslotId,
  affirmativeTeamId: `${id}-aff`,
  negativeTeamId: `${id}-neg`,
  institutionIds,
  bracket: 0,
  currentAssignmentCount: 0,
});

describe("allocateAdjudicators", () => {
  it("locks an adjudicator out of a timeslot once placed in it", () => {
    const result = allocateAdjudicators({
      debates: [debate("d1", "t1"), debate("d2", "t1")],
      adjudicators: [adj("a")],
      config: { ...defaultCompetitionConfig, panelSize: 1 },
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.unfilledDebateIds).toEqual(["d2"]);
  });

  it("allows the same adjudicator in different timeslots", () => {
    const result = allocateAdjudicators({
      debates: [debate("d1", "t1"), debate("d2", "t2")],
      adjudicators: [adj("a")],
      config: { ...defaultCompetitionConfig, panelSize: 1 },
    });
    expect(result.assignments).toHaveLength(2);
  });

  it("skips hard conflicts and unavailable timeslots", () => {
    const result = allocateAdjudicators({
      debates: [debate("d1", "t1", ["blocked"]), debate("d2", "t2")],
      adjudicators: [
        adj("a", { conflictInstitutionIds: ["blocked"], unavailableTimeslotIds: new Set(["t2"]) }),
      ],
      config: defaultCompetitionConfig,
    });
    expect(result.assignments).toHaveLength(0);
  });

  it("prefers adjudicators without an own-school conflict", () => {
    const result = allocateAdjudicators({
      debates: [debate("d1", "t1", ["school"])],
      adjudicators: [adj("own", { ownInstitutionIds: ["school"] }), adj("other")],
      config: defaultCompetitionConfig,
    });
    expect(result.assignments[0]?.adjudicatorId).toBe("other");
  });

  it("explains eligibility", () => {
    const e = checkEligibility(
      adj("a", { lockedTimeslotIds: new Set(["t1"]), ownInstitutionIds: ["s"] }),
      debate("d1", "t1", ["s"])
    );
    expect(e.ok).toBe(false);
    expect(e.hard[0]).toMatch(/Already judging/);
    expect(e.soft[0]).toMatch(/Own school/);
  });
});
