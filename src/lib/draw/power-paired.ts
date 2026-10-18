import type { CompetitionConfig, DrawOptions, OddBracketMethod } from "@/db/schema";
import { oneUpOneDown } from "./one-up-one-down";
import { makeRawBrackets, sameInstitution, timesMet } from "./rank";
import { shuffleInPlace } from "./rng";
import type { DrawTeam, Pairing, Rng } from "./types";

export type Bracket = { points: number; teams: DrawTeam[] };

/** Ordered brackets (highest points first). */
export function rawBrackets(
  teams: DrawTeam[],
  config: CompetitionConfig,
  options: DrawOptions
): Bracket[] {
  const map = makeRawBrackets(teams, config, options);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([points, list]) => ({ points, teams: list }));
}

function pullupEligible(teams: DrawTeam[], options: DrawOptions): DrawTeam[] {
  switch (options.pullupRestriction) {
    case "least_to_date": {
      const min = Math.min(...teams.map((t) => t.pullups));
      return teams.filter((t) => t.pullups === min);
    }
    case "lowest_ds_wins": {
      const min = Math.min(...teams.map((t) => t.drawStrengthWins));
      return teams.filter((t) => t.drawStrengthWins === min);
    }
    case "lowest_ds_speaks": {
      const min = Math.min(...teams.map((t) => t.drawStrengthSpeaks));
      return teams.filter((t) => t.drawStrengthSpeaks === min);
    }
    default:
      return teams;
  }
}

function pullupPosition(method: OddBracketMethod, n: number, rng: Rng): number {
  switch (method) {
    case "pullup_bottom":
      return n - 1;
    case "pullup_middle":
      return Math.floor((n - 1) / 2);
    case "pullup_random":
      return Math.floor(rng() * n);
    default:
      return 0;
  }
}

/**
 * Tabbycat `_pullup`: walk brackets top-down; when a bracket is odd, pull one
 * eligible team up from the next non-empty lower bracket.
 */
function resolvePullup(
  brackets: Bracket[],
  options: DrawOptions,
  rng: Rng,
  pulledUp: Set<string>
): Bracket[] {
  let needsPullup: Bracket | null = null;
  for (const bracket of brackets) {
    if (needsPullup && bracket.teams.length > 0) {
      const eligible = pullupEligible(bracket.teams, options);
      const team = eligible[pullupPosition(options.oddBracket, eligible.length, rng)]!;
      bracket.teams.splice(bracket.teams.indexOf(team), 1);
      needsPullup.teams.push(team);
      pulledUp.add(team.id);
      needsPullup = null;
    }
    if (bracket.teams.length % 2 !== 0) needsPullup = bracket;
  }
  if (needsPullup) {
    throw new Error("Lowest bracket is still odd after pullups — this should be impossible after bye allocation");
  }
  return brackets.filter((b) => b.teams.length > 0);
}

/**
 * Tabbycat `_intermediate_brackets`: the bottom team of an odd bracket and the
 * top team of the next bracket form an intermediate bracket at points + 0.5.
 */
function resolveIntermediate(brackets: Bracket[], pulledUp: Set<string>): Bracket[] {
  const out: Bracket[] = [];
  let odd: DrawTeam | null = null;
  for (const bracket of brackets) {
    if (odd && bracket.teams.length > 0) {
      const top = bracket.teams.shift()!;
      pulledUp.add(top.id);
      out.push({ points: bracket.points + 0.5, teams: [odd, top] });
      odd = null;
    }
    if (bracket.teams.length % 2 !== 0) odd = bracket.teams.pop()!;
    if (bracket.teams.length > 0) out.push(bracket);
  }
  if (odd) {
    throw new Error("Lowest bracket is still odd after intermediate brackets");
  }
  return out.sort((a, b) => b.points - a.points);
}

/**
 * Tabbycat `_intermediate_brackets_with_up_down`: after forming intermediate
 * brackets, if the two teams in one conflict, try swapping the lower team with
 * another team from the bracket below (bubble down), else the upper team with a
 * team from the bracket above (bubble up).
 */
function resolveIntermediateBubble(
  brackets: Bracket[],
  options: DrawOptions,
  pulledUp: Set<string>
): Bracket[] {
  const out = resolveIntermediate(brackets, pulledUp);
  const conflict = (a: DrawTeam, b: DrawTeam) =>
    (options.avoidHistory && timesMet(a, b) > 0) ||
    (options.avoidSameInstitution && sameInstitution(a, b));

  for (const bracket of out) {
    if (bracket.points % 1 === 0) continue;
    const [upper, lower] = bracket.teams as [DrawTeam, DrawTeam];
    if (!conflict(upper, lower)) continue;

    const below = out.find((b) => b.points === bracket.points - 0.5);
    const above = out.find((b) => b.points === bracket.points + 0.5);

    let swapped = false;
    if (below) {
      for (let i = 0; i < below.teams.length; i++) {
        const cand = below.teams[i]!;
        if (!conflict(upper, cand)) {
          below.teams[i] = lower;
          bracket.teams[1] = cand;
          pulledUp.delete(lower.id);
          pulledUp.add(cand.id);
          swapped = true;
          break;
        }
      }
    }
    if (!swapped && above) {
      for (let i = above.teams.length - 1; i >= 0; i--) {
        const cand = above.teams[i]!;
        if (!conflict(cand, lower)) {
          above.teams[i] = upper;
          bracket.teams[0] = cand;
          break;
        }
      }
    }
  }
  return out;
}

export function resolveOddBrackets(
  brackets: Bracket[],
  options: DrawOptions,
  rng: Rng,
  pulledUp: Set<string>
): Bracket[] {
  switch (options.oddBracket) {
    case "intermediate":
      return resolveIntermediate(brackets, pulledUp);
    case "intermediate_bubble_up_down":
      return resolveIntermediateBubble(brackets, options, pulledUp);
    default:
      return resolvePullup(brackets, options, rng, pulledUp);
  }
}

function pairBracket(
  teams: DrawTeam[],
  method: DrawOptions["pairingMethod"],
  rng: Rng
): [DrawTeam, DrawTeam][] {
  const n = teams.length;
  const half = n / 2;
  switch (method) {
    case "fold": {
      const top = teams.slice(0, half);
      const bottom = teams.slice(half).reverse();
      return top.map((t, i) => [t, bottom[i]!]);
    }
    case "slide": {
      const top = teams.slice(0, half);
      const bottom = teams.slice(half);
      return top.map((t, i) => [t, bottom[i]!]);
    }
    case "random": {
      const shuffled = shuffleInPlace([...teams], rng);
      const pairs: [DrawTeam, DrawTeam][] = [];
      for (let i = 0; i < n; i += 2) pairs.push([shuffled[i]!, shuffled[i + 1]!]);
      return pairs;
    }
    case "adjacent":
    default: {
      const pairs: [DrawTeam, DrawTeam][] = [];
      for (let i = 0; i < n; i += 2) pairs.push([teams[i]!, teams[i + 1]!]);
      return pairs;
    }
  }
}

/** Tabbycat `generate_pairings`: pair within each (resolved, even) bracket. */
export function pairBrackets(
  brackets: Bracket[],
  options: DrawOptions,
  rng: Rng,
  pulledUp: Set<string>
): Pairing[][] {
  const result: Pairing[][] = [];
  let roomRank = 1;
  brackets.forEach((bracket, index) => {
    const method =
      options.pairingMethod === "fold_top_adjacent_rest"
        ? index === 0
          ? "fold"
          : "adjacent"
        : options.pairingMethod;
    const pairs = pairBracket(bracket.teams, method, rng);
    result.push(
      pairs.map(([a, b]) => {
        const teamFlags: Pairing["teamFlags"] = {};
        const flags: Pairing["flags"] = [];
        for (const t of [a, b]) {
          if (pulledUp.has(t.id)) {
            teamFlags[t.id] = ["pullup"];
            if (!flags.includes("pullup")) flags.push("pullup");
          }
        }
        if (bracket.points % 1 !== 0 && !flags.includes("bubble")) flags.push("bubble");
        return {
          teams: [a, b],
          bracket: bracket.points,
          roomRank: roomRank++,
          flags,
          teamFlags,
          affIndex: 0,
        };
      })
    );
  });
  return result;
}

/** Full Tabbycat power-paired flow for one even-sized group of teams. */
export function powerPair(
  teams: DrawTeam[],
  config: CompetitionConfig,
  options: DrawOptions,
  rng: Rng
): Pairing[] {
  if (teams.length % 2 !== 0) {
    throw new Error("powerPair requires an even number of teams (allocate a bye first)");
  }
  const pulledUp = new Set<string>();
  const brackets = resolveOddBrackets(rawBrackets(teams, config, options), options, rng, pulledUp);
  const byBracket = pairBrackets(brackets, options, rng, pulledUp);
  if (options.conflictAvoidance === "one_up_one_down") {
    for (const pairings of byBracket) oneUpOneDown(pairings, options);
  }
  return byBracket.flat();
}
