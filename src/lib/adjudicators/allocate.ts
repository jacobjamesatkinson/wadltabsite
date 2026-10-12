import type { CompetitionConfig } from "@/db/schema";

export type AdjCandidate = {
  id: string;
  userId: string;
  assignmentCount: number;
  conflictInstitutionIds: string[];
  conflictTeamIds: string[];
  availableTimeslotIds: Set<string>;
};

export type DebateForAllocation = {
  id: string;
  timeslotId: string | null;
  affirmativeTeamId: string | null;
  negativeTeamId: string | null;
  institutionIds: string[];
  currentAssignmentCount: number;
};

export type AllocationResult = {
  assignments: Array<{ debateId: string; adjudicatorId: string; role: string }>;
  unfilledDebateIds: string[];
  warnings: string[];
};

/**
 * Fair distribution of adjudicators respecting availability and conflicts.
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
  const used = new Map<string, Set<string>>(); // timeslot -> adjudicator ids
  const counts = new Map(adjudicators.map((a) => [a.id, a.assignmentCount]));

  const sortedDebates = [...debates].sort(
    (a, b) => a.currentAssignmentCount - b.currentAssignmentCount
  );

  for (const debate of sortedDebates) {
    const needed = panelSize - debate.currentAssignmentCount;
    if (needed <= 0) continue;
    if (!debate.timeslotId) {
      warnings.push(`Debate ${debate.id} has no timeslot`);
      continue;
    }

    const slotUsed = used.get(debate.timeslotId) ?? new Set();
    const eligible = adjudicators
      .filter((adj) => {
        if (slotUsed.has(adj.id)) return false;
        if (!adj.availableTimeslotIds.has(debate.timeslotId!)) return false;
        if (
          debate.affirmativeTeamId &&
          adj.conflictTeamIds.includes(debate.affirmativeTeamId)
        ) {
          return false;
        }
        if (
          debate.negativeTeamId &&
          adj.conflictTeamIds.includes(debate.negativeTeamId)
        ) {
          return false;
        }
        if (
          debate.institutionIds.some((id) => adj.conflictInstitutionIds.includes(id))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));

    let assigned = 0;
    for (const adj of eligible) {
      if (assigned >= needed) break;
      assignments.push({
        debateId: debate.id,
        adjudicatorId: adj.id,
        role: assigned === 0 && debate.currentAssignmentCount === 0 ? "chair" : "panellist",
      });
      slotUsed.add(adj.id);
      counts.set(adj.id, (counts.get(adj.id) ?? 0) + 1);
      assigned++;
    }
    used.set(debate.timeslotId, slotUsed);

    if (assigned < needed) {
      warnings.push(
        `Debate ${debate.id} short by ${needed - assigned} adjudicator(s)`
      );
    }
  }

  const filled = new Map<string, number>();
  for (const a of assignments) {
    filled.set(a.debateId, (filled.get(a.debateId) ?? 0) + 1);
  }

  const unfilledDebateIds = debates
    .filter((d) => (d.currentAssignmentCount + (filled.get(d.id) ?? 0)) < panelSize)
    .map((d) => d.id);

  return { assignments, unfilledDebateIds, warnings };
}
