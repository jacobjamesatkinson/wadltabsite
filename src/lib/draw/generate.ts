import { defaultDrawOptions, type DrawOptions } from "@/db/schema";
import { allocateBye } from "./bye";
import { randomPair, roundRobinPair } from "./other-generators";
import { partitionTeams } from "./partition";
import { powerPair } from "./power-paired";
import { sameInstitution, timesMet } from "./rank";
import { buildReport } from "./report";
import { createRng } from "./rng";
import { assignRooms } from "./rooms";
import { allocateSides } from "./sides";
import {
  DrawFatalError,
  type DrawGenerationInput,
  type DrawGenerationResult,
  type DrawIssue,
  type GeneratedBye,
  type GeneratedDebate,
  type Pairing,
} from "./types";

export { DrawFatalError };

/**
 * Generate a draw for a round. Pairing happens independently inside each
 * (venue, timeslot, division) group; rooms come only from the group's venue.
 * Never throws for data problems — those are returned in `report.issues`.
 */
export function generateDraw(input: DrawGenerationInput): DrawGenerationResult {
  const seed = input.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const options: DrawOptions = {
    ...defaultDrawOptions,
    ...input.config.draw,
    ...input.options,
  };

  const effectiveType =
    options.type === "power_paired" &&
    input.roundNumber === 1 &&
    options.firstRoundType === "random"
      ? "random"
      : options.type;

  const venueName = new Map(input.venues.map((v) => [v.id, v.name]));
  const slotLabel = new Map(input.timeslots.map((t) => [t.id, t.startsAt]));
  const divisionName = new Map(input.divisions.map((d) => [d.id, d.name]));
  const labels = {
    venue: (id: string) => venueName.get(id) ?? "Unknown venue",
    timeslot: (id: string) => slotLabel.get(id) ?? "Unknown timeslot",
    division: (id: string) => divisionName.get(id) ?? "Unknown division",
  };

  const partition = partitionTeams(input.teams, input.venues, input.timeslots, input.divisions);
  const issues: DrawIssue[] = [...partition.issues];
  const debates: GeneratedDebate[] = [];
  const byes: GeneratedBye[] = [];

  for (const group of partition.groups) {
    const where = `${labels.venue(group.key.venueId)} · ${labels.timeslot(group.key.timeslotId)} · ${labels.division(group.key.divisionId)}`;

    if (group.teams.length === 1) {
      const only = group.teams[0]!;
      issues.push({
        code: "single_team_group",
        severity: "warning",
        message: `${only.name} is the only team at ${where} and cannot be paired — it receives a bye`,
        teamIds: [only.id],
        ...group.key,
        fixHref: `/admin/teams/${only.id}`,
      });
      byes.push({
        teamId: only.id,
        teamName: only.name,
        group: group.key,
        reason: "Only team in its venue, timeslot and division",
        automatic: true,
      });
      continue;
    }

    let pool = group.teams;
    if (effectiveType !== "manual") {
      const byeResult = allocateBye(pool, group.key, input.config, options, rng, {
        venue: labels.venue(group.key.venueId),
        timeslot: labels.timeslot(group.key.timeslotId),
        division: labels.division(group.key.divisionId),
      });
      pool = byeResult.remaining;
      if (byeResult.bye) byes.push(byeResult.bye);
      issues.push(...byeResult.issues);
    }

    let pairings: Pairing[] = [];
    try {
      switch (effectiveType) {
        case "random":
          pairings = randomPair(pool, rng);
          break;
        case "round_robin":
          pairings = roundRobinPair(pool, input.roundNumber);
          break;
        case "manual":
          pairings = [];
          break;
        case "power_paired":
        default:
          pairings = powerPair(pool, input.config, options, rng);
      }
    } catch (error) {
      issues.push({
        code: "generator_error",
        severity: "fatal",
        message: `${where}: ${error instanceof Error ? error.message : String(error)}`,
        ...group.key,
      });
      continue;
    }

    if (effectiveType === "manual") {
      issues.push({
        code: "manual_draw",
        severity: "info",
        message: `${where}: ${pool.length} teams left unpaired for manual matchups`,
        teamIds: pool.map((t) => t.id),
        ...group.key,
      });
      // Create empty rooms for the admin to fill.
      const slots = Math.floor(pool.length / 2);
      for (let i = 0; i < slots; i++) {
        debates.push({
          group: group.key,
          affirmativeTeamId: "",
          negativeTeamId: "",
          affirmativeTeamName: "",
          negativeTeamName: "",
          divisionId: group.key.divisionId,
          venueId: group.key.venueId,
          timeslotId: group.key.timeslotId,
          roomId: null,
          bracket: 0,
          roomRank: i + 1,
          flags: ["manual"],
          isPullUp: false,
          isRematch: false,
          isSameInstitution: false,
        });
      }
      continue;
    }

    allocateSides(pairings, options.sideAllocation, rng);

    for (const pairing of pairings) {
      const aff = pairing.teams[pairing.affIndex];
      const neg = pairing.teams[pairing.affIndex === 0 ? 1 : 0];
      const met = timesMet(aff, neg);
      const sameInst = sameInstitution(aff, neg);
      const flags = [...pairing.flags];
      if (met > 0) {
        flags.push("rematch");
        issues.push({
          code: effectiveType === "round_robin" ? "round_robin_rematch" : "rematch",
          severity: "warning",
          message: `${aff.name} and ${neg.name} have already met ${met === 1 ? "once" : `${met} times`} (${where})`,
          teamIds: [aff.id, neg.id],
          ...group.key,
        });
      }
      if (sameInst) {
        flags.push("same_institution");
        issues.push({
          code: "same_institution",
          severity: "warning",
          message: `${aff.name} and ${neg.name} are from the same school (${where})`,
          teamIds: [aff.id, neg.id],
          ...group.key,
        });
      }
      const pullupTeams = Object.keys(pairing.teamFlags);
      if (pullupTeams.length > 0) {
        const names = pullupTeams
          .map((id) => pairing.teams.find((t) => t.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        issues.push({
          code: "pullup",
          severity: "info",
          message: `${names} pulled up to the ${pairing.bracket}-win bracket (${where})`,
          teamIds: pullupTeams,
          ...group.key,
        });
      }
      debates.push({
        group: group.key,
        affirmativeTeamId: aff.id,
        negativeTeamId: neg.id,
        affirmativeTeamName: aff.name,
        negativeTeamName: neg.name,
        divisionId: group.key.divisionId,
        venueId: group.key.venueId,
        timeslotId: group.key.timeslotId,
        roomId: null,
        bracket: pairing.bracket,
        roomRank: pairing.roomRank,
        flags,
        isPullUp: flags.includes("pullup"),
        isRematch: met > 0,
        isSameInstitution: sameInst,
      });
    }
  }

  issues.push(...assignRooms(debates, input.rooms, labels));

  const report = buildReport({
    issues,
    debates,
    byes,
    groups: partition.groups.length,
    teams: input.teams.length,
  });

  return { debates, byes, report, options, seed };
}
