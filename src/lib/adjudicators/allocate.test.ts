import { describe, expect, it } from "vitest";
import { defaultCompetitionConfig } from "@/db/schema";
import { allocateAdjudicators } from "./allocate";

describe("allocateAdjudicators", () => {
  it("does not double-book an adjudicator in one timeslot", () => {
    const result = allocateAdjudicators({
      debates: [
        {
          id: "d1",
          timeslotId: "t1",
          affirmativeTeamId: "a",
          negativeTeamId: "b",
          institutionIds: ["i1", "i2"],
          currentAssignmentCount: 0,
        },
        {
          id: "d2",
          timeslotId: "t1",
          affirmativeTeamId: "c",
          negativeTeamId: "d",
          institutionIds: ["i3", "i4"],
          currentAssignmentCount: 0,
        },
      ],
      adjudicators: [
        {
          id: "adj1",
          userId: "u1",
          assignmentCount: 0,
          conflictInstitutionIds: [],
          conflictTeamIds: [],
          availableTimeslotIds: new Set(["t1"]),
        },
      ],
      config: { ...defaultCompetitionConfig, panelSize: 1 },
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.unfilledDebateIds).toContain("d2");
  });

  it("skips conflicting institutions", () => {
    const result = allocateAdjudicators({
      debates: [
        {
          id: "d1",
          timeslotId: "t1",
          affirmativeTeamId: "a",
          negativeTeamId: "b",
          institutionIds: ["blocked"],
          currentAssignmentCount: 0,
        },
      ],
      adjudicators: [
        {
          id: "adj1",
          userId: "u1",
          assignmentCount: 0,
          conflictInstitutionIds: ["blocked"],
          conflictTeamIds: [],
          availableTimeslotIds: new Set(["t1"]),
        },
      ],
      config: defaultCompetitionConfig,
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.unfilledDebateIds).toEqual(["d1"]);
  });
});
