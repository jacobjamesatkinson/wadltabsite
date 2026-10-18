import { shuffleInPlace } from "./rng";
import type { DrawTeam, Pairing, Rng } from "./types";

function toPairings(pairs: [DrawTeam, DrawTeam][], bracket = 0): Pairing[] {
  return pairs.map(([a, b], i) => ({
    teams: [a, b],
    bracket,
    roomRank: i + 1,
    flags: [],
    teamFlags: {},
    affIndex: 0,
  }));
}

/** Tabbycat RandomDrawGenerator: shuffle and pair adjacent. */
export function randomPair(teams: DrawTeam[], rng: Rng): Pairing[] {
  const shuffled = shuffleInPlace([...teams], rng);
  const pairs: [DrawTeam, DrawTeam][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push([shuffled[i]!, shuffled[i + 1]!]);
  }
  return toPairings(pairs);
}

/**
 * Tabbycat RoundRobinDrawGenerator (circle method). `teams` must be even; the
 * caller handles byes. Round r (1-based) fixes the first team and rotates the
 * rest by r-1 so every team meets every other once per n-1 rounds.
 */
export function roundRobinPair(teams: DrawTeam[], roundNumber: number): Pairing[] {
  const ordered = [...teams].sort((a, b) => a.id.localeCompare(b.id));
  const n = ordered.length;
  if (n < 2) return [];
  const fixed = ordered[0]!;
  const rest = ordered.slice(1);
  const rotation = (roundNumber - 1) % (n - 1);
  const rotated = [...rest.slice(rest.length - rotation), ...rest.slice(0, rest.length - rotation)];
  const circle = [fixed, ...rotated];
  const pairs: [DrawTeam, DrawTeam][] = [];
  for (let i = 0; i < n / 2; i++) {
    pairs.push([circle[i]!, circle[n - 1 - i]!]);
  }
  return toPairings(pairs);
}
