import type { CompetitionConfig } from "@/db/schema";

export type AdjCandidate = {
  id: string;
  userId: string;
  name: string;
  /** Total assignments across the competition so far (for load balancing). */
  assignmentCount: number;
  /** Explicit conflicts. */
  conflictInstitutionIds: string[];
  conflictTeamIds: string[];
  /** The adjudicator's own school (from an institution membership) — soft conflict. */
  ownInstitutionIds: string[];
  /** Timeslots (within this round) the adjudicator has marked unavailable. */
  unavailableTimeslotIds: Set<string>;
  /** Timeslots (within this round) the adjudicator is already judging in. */
  lockedTimeslotIds: Set<string>;
};

export type DebateForAllocation = {
  id: string;
  venueId: string | null;
  timeslotId: string | null;
  affirmativeTeamId: string | null;
  negativeTeamId: string | null;
  institutionIds: string[];
  bracket: number;
  currentAssignmentCount: number;
};

export type AllocationResult = {
  assignments: Array<{ debateId: string; adjudicatorId: string; role: string }>;
  unfilledDebateIds: string[];
  warnings: string[];
};

export type Eligibility = {
  ok: boolean;
  /** Hard reasons (cannot allocate). */
  hard: string[];
  /** Soft reasons (allowed, but flagged). */
  soft: string[];
};

/** Why an adjudicator can or cannot take a debate. Shared by auto and manual allocation. */
export function checkEligibility(adj: AdjCandidate, debate: DebateForAllocation): Eligibility {
  const hard: string[] = [];
  const soft: string[] = [];
  if (!debate.timeslotId) hard.push("Debate has no timeslot");
  if (debate.timeslotId && adj.lockedTimeslotIds.has(debate.timeslotId)) {
    hard.push("Already judging another room in this timeslot");
  }
  if (debate.timeslotId && adj.unavailableTimeslotIds.has(debate.timeslotId)) {
    hard.push("Marked unavailable for this timeslot");
  }
  for (const teamId of [debate.affirmativeTeamId, debate.negativeTeamId]) {
    if (teamId && adj.conflictTeamIds.includes(teamId)) hard.push("Conflict with a team in this room");
  }
  if (debate.institutionIds.some((id) => adj.conflictInstitutionIds.includes(id))) {
    hard.push("Conflict with a school in this room");
  }
  if (debate.institutionIds.some((id) => adj.ownInstitutionIds.includes(id))) {
    soft.push("Own school is debating in this room");
  }
  return { ok: hard.length === 0, hard, soft };
}

/**
 * Greedy allocation: higher brackets first, each room takes the least-loaded
 * eligible adjudicator, preferring those without a soft (own-school) conflict.
 * Anyone placed in a timeslot is locked out of that timeslot for the rest of
 * the run.
 */
export function allocateAdjudicators(params: {
  debates: DebateForAllocation[];
  adjudicators: AdjCandidate[];
  config: CompetitionConfig;
}): AllocationResult {
  const { debates, adjudicators, config } = params;
  const panelSize = Math.max(1, config.panelSize);
  const assignments: AllocationResult["assignments"] = [];
  const warnings: string[] = [];
  const counts = new Map(adjudicators.map((a) => [a.id, a.assignmentCount]));
  const locked = new Map(
    adjudicators.map((a) => [a.id, new Set(a.lockedTimeslotIds)])
  );

  const sortedDebates = [...debates].sort(
    (a, b) =>
      a.currentAssignmentCount - b.currentAssignmentCount || b.bracket - a.bracket
  );

  for (const debate of sortedDebates) {
    const needed = panelSize - debate.currentAssignmentCount;
    if (needed <= 0) continue;
    if (!debate.timeslotId) {
      warnings.push(`A room has no timeslot and was skipped`);
      continue;
    }

    const candidates = adjudicators
      .map((adj) => ({
        adj,
        eligibility: checkEligibility(
          { ...adj, lockedTimeslotIds: locked.get(adj.id) ?? adj.lockedTimeslotIds },
          debate
        ),
      }))
      .filter((c) => c.eligibility.ok)
      .sort(
        (a, b) =>
          a.eligibility.soft.length - b.eligibility.soft.length ||
          (counts.get(a.adj.id) ?? 0) - (counts.get(b.adj.id) ?? 0) ||
          a.adj.name.localeCompare(b.adj.name)
      );

    let assigned = 0;
    for (const { adj, eligibility } of candidates) {
      if (assigned >= needed) break;
      assignments.push({
        debateId: debate.id,
        adjudicatorId: adj.id,
        role: assigned === 0 && debate.currentAssignmentCount === 0 ? "chair" : "panellist",
      });
      locked.get(adj.id)!.add(debate.timeslotId);
      counts.set(adj.id, (counts.get(adj.id) ?? 0) + 1);
      if (eligibility.soft.length > 0) {
        warnings.push(`${adj.name}: ${eligibility.soft.join("; ")}`);
      }
      assigned++;
    }

    if (assigned < needed) {
      warnings.push(`A room is short by ${needed - assigned} adjudicator(s)`);
    }
  }

  const filled = new Map<string, number>();
  for (const a of assignments) filled.set(a.debateId, (filled.get(a.debateId) ?? 0) + 1);

  const unfilledDebateIds = debates
    .filter((d) => d.currentAssignmentCount + (filled.get(d.id) ?? 0) < panelSize)
    .map((d) => d.id);

  return { assignments, unfilledDebateIds, warnings };
}
