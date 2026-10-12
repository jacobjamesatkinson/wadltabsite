import { createId } from "@/lib/id";
import { rankTeams, groupByWins } from "./rank";
import { createRng, shuffleInPlace } from "./rng";
import type {
  DrawGenerationInput,
  DrawGenerationResult,
  DrawTeam,
  GeneratedDebate,
  GeneratedBye,
  PriorMatch,
} from "./types";

function haveMet(a: string, b: string, prior: PriorMatch[]): boolean {
  return prior.some(
    (m) =>
      (m.teamAId === a && m.teamBId === b) || (m.teamAId === b && m.teamBId === a)
  );
}

function pairScore(
  a: DrawTeam,
  b: DrawTeam,
  prior: PriorMatch[],
  config: DrawGenerationInput["config"]
): number {
  let score = 0;
  // Prefer closer win records
  score += Math.abs(a.wins - b.wins) * 100;
  if (config.pairing.avoidRematch && haveMet(a.id, b.id, prior)) score += 1000;
  if (config.pairing.avoidSameInstitution && a.institutionId === b.institutionId) {
    score += 500;
  }
  return score;
}

function allocateBye(
  teams: DrawTeam[],
  config: DrawGenerationInput["config"],
  compromises: string[],
  softWarnings: string[]
): { remaining: DrawTeam[]; bye: GeneratedBye | null } {
  if (teams.length % 2 === 0) {
    return { remaining: teams, bye: null };
  }

  const ranked = rankTeams(teams, config);
  // Prefer lowest-ranked for bye
  const candidates = [...ranked].reverse();

  let chosen = candidates.find((t) => t.byes === 0) ?? null;
  if (!chosen) {
    chosen = candidates[0]!;
    softWarnings.push(
      `Second bye allocated to ${chosen.name} — no team without a prior bye was available.`
    );
    compromises.push("second_bye");
  }

  const reason =
    chosen.byes > 0
      ? `Uneven bracket; second bye (no alternative without prior bye)`
      : `Uneven bracket; lowest-ranked eligible team`;

  return {
    remaining: teams.filter((t) => t.id !== chosen!.id),
    bye: {
      teamId: chosen.id,
      reason,
      automatic: true,
    },
  };
}

function pairBracket(
  bracket: DrawTeam[],
  prior: PriorMatch[],
  config: DrawGenerationInput["config"],
  rng: () => number,
  compromises: string[],
  softWarnings: string[]
): Array<{ a: DrawTeam; b: DrawTeam; pullUp: boolean }> {
  const pool = shuffleInPlace([...bracket], rng);
  const pairs: Array<{ a: DrawTeam; b: DrawTeam; pullUp: boolean }> = [];
  const used = new Set<string>();

  // Greedy: for each unpaired team, pick best available opponent
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]!;
    if (used.has(a.id)) continue;
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j]!;
      if (used.has(b.id)) continue;
      const s = pairScore(a, b, prior, config);
      if (s < bestScore) {
        bestScore = s;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) {
      const b = pool[bestIdx]!;
      used.add(a.id);
      used.add(b.id);
      if (config.pairing.avoidRematch && haveMet(a.id, b.id, prior)) {
        softWarnings.push(`Rematch: ${a.name} vs ${b.name}`);
        compromises.push("rematch");
      }
      if (config.pairing.avoidSameInstitution && a.institutionId === b.institutionId) {
        softWarnings.push(`Same institution: ${a.name} vs ${b.name}`);
        compromises.push("same_institution");
      }
      pairs.push({ a, b, pullUp: false });
    }
  }

  return pairs;
}

/**
 * Power-pairing draw generator.
 * Hard constraints: no self-debate, no double-booking of teams/rooms in same timeslot.
 * Soft: power pair, avoid rematch/same-institution, minimise pull-ups.
 */
export function generateDraw(input: DrawGenerationInput): DrawGenerationResult {
  const seed = input.seed ?? createId("seed");
  const rng = createRng(seed);
  const hardViolations: string[] = [];
  const softWarnings: string[] = [];
  const compromises: string[] = [];

  let teams = [...input.teams];
  if (input.scope === "division" && input.scopeId) {
    teams = teams.filter((t) => t.divisionId === input.scopeId);
  }

  // Validate uniqueness
  const ids = new Set<string>();
  for (const t of teams) {
    if (ids.has(t.id)) hardViolations.push(`Duplicate team in input: ${t.id}`);
    ids.add(t.id);
  }

  const { remaining, bye } = allocateBye(teams, input.config, compromises, softWarnings);
  const byes: GeneratedBye[] = bye ? [bye] : [];

  // Group by wins (high to low), pair within groups, pull up leftovers
  const ranked = rankTeams(remaining, input.config);
  const byWins = groupByWins(ranked);
  const winLevels = [...byWins.keys()].sort((a, b) => b - a);

  const allPairs: Array<{ a: DrawTeam; b: DrawTeam; pullUp: boolean }> = [];
  let carry: DrawTeam[] = [];

  for (const wins of winLevels) {
    const group = [...(byWins.get(wins) ?? []), ...carry];
    carry = [];
    if (group.length % 2 === 1) {
      // Pull-up: carry the lowest-ranked in this group to next (lower) bracket
      const sorted = rankTeams(group, input.config);
      const pull = sorted[sorted.length - 1]!;
      carry = [pull];
      compromises.push("pull_up");
      softWarnings.push(
        `Pull-up: ${pull.name} moved from ${wins}-win bracket to pair with lower bracket`
      );
      const pairable = group.filter((t) => t.id !== pull.id);
      allPairs.push(
        ...pairBracket(pairable, input.priorMatches, input.config, rng, compromises, softWarnings)
      );
    } else {
      allPairs.push(
        ...pairBracket(group, input.priorMatches, input.config, rng, compromises, softWarnings)
      );
    }
  }

  if (carry.length > 0) {
    // Should not happen if bye handled odd count; leftover is a hard issue
    for (const t of carry) {
      hardViolations.push(`Unpaired team after brackets: ${t.name}`);
    }
  }

  // Allocate rooms and timeslots without conflicts
  const rooms =
    input.scope === "venue" && input.scopeId
      ? input.rooms.filter((r) => r.venueId === input.scopeId)
      : [...input.rooms];
  const timeslots = [...input.timeslots].sort((a, b) => a.sortOrder - b.sortOrder);

  if (rooms.length === 0 && allPairs.length > 0) {
    hardViolations.push("No rooms available for debate allocation");
  }
  if (timeslots.length === 0 && allPairs.length > 0) {
    hardViolations.push("No timeslots available for debate allocation");
  }

  const capacity = rooms.length * Math.max(timeslots.length, 1);
  if (allPairs.length > capacity && rooms.length > 0 && timeslots.length > 0) {
    hardViolations.push(
      `Insufficient room/timeslot capacity: ${allPairs.length} debates need slots, capacity ${capacity}`
    );
  }

  const debates: GeneratedDebate[] = [];
  let slotIndex = 0;

  for (const pair of allPairs) {
    const room = rooms.length > 0 ? rooms[slotIndex % rooms.length]! : null;
    const timeslot =
      timeslots.length > 0
        ? timeslots[Math.floor(slotIndex / Math.max(rooms.length, 1)) % timeslots.length]!
        : null;
    slotIndex++;

    // Side allocation: higher-ranked affirmative by default (configurable fairness later)
    const [aff, neg] =
      pair.a.wins > pair.b.wins ||
      (pair.a.wins === pair.b.wins && pair.a.speakerPoints >= pair.b.speakerPoints)
        ? [pair.a, pair.b]
        : [pair.b, pair.a];

    // Flip sides with seed for fairness occasionally
    const useFlip = input.config.sides.balanceFairness && rng() > 0.5;
    const affirmative = useFlip ? neg : aff;
    const negative = useFlip ? aff : neg;

    if (affirmative.id === negative.id) {
      hardViolations.push(`Team paired against itself: ${affirmative.name}`);
      continue;
    }

    debates.push({
      affirmativeTeamId: affirmative.id,
      negativeTeamId: negative.id,
      affirmativeTeamName: affirmative.name,
      negativeTeamName: negative.name,
      divisionId: affirmative.divisionId ?? negative.divisionId,
      venueId: room?.venueId ?? null,
      roomId: room?.id ?? null,
      timeslotId: timeslot?.id ?? null,
      isPullUp: pair.pullUp,
      isRematch: haveMet(affirmative.id, negative.id, input.priorMatches),
      isSameInstitution: affirmative.institutionId === negative.institutionId,
    });
  }

  // Detect double-booked teams (should never happen if pairing correct)
  const teamSlots = new Map<string, string>();
  for (const d of debates) {
    for (const tid of [d.affirmativeTeamId, d.negativeTeamId]) {
      const key = `${tid}:${d.timeslotId ?? "none"}`;
      if (teamSlots.has(key)) {
        hardViolations.push(`Team double-booked in timeslot: ${tid}`);
      }
      teamSlots.set(key, d.affirmativeTeamId);
    }
  }

  return {
    debates,
    byes,
    hardViolations,
    softWarnings,
    compromises: [...new Set(compromises)],
    seed,
  };
}

export { rankTeams };
