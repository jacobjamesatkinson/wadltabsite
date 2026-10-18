import type { DrawOptions } from "@/db/schema";
import { sameInstitution, timesMet } from "./rank";
import type { DrawTeam, Pairing } from "./types";

const HISTORY_PENALTY = 1000;
const INSTITUTION_PENALTY = 1;

/**
 * Port of Tabbycat's OneUpOneDownSwapper.
 *
 * Within a bracket, pairing i and pairing i+1 may swap their lower teams
 * ((a1,b1),(a2,b2) → (a1,b2),(a2,b1)). Each candidate swap is scored by the
 * change in conflict penalty; we choose the set of non-adjacent swaps that
 * minimises total penalty. History conflicts outweigh institution conflicts.
 */
export function oneUpOneDown(
  pairings: Pairing[],
  options: Pick<DrawOptions, "avoidHistory" | "avoidSameInstitution">
): number {
  if (pairings.length < 2) return 0;

  const score = (a: DrawTeam, b: DrawTeam) => {
    let s = 0;
    if (options.avoidHistory) s += timesMet(a, b) * HISTORY_PENALTY;
    if (options.avoidSameInstitution && sameInstitution(a, b)) s += INSTITUTION_PENALTY;
    return s;
  };

  const deltas: number[] = [];
  for (let i = 0; i < pairings.length - 1; i++) {
    const [a1, b1] = pairings[i]!.teams;
    const [a2, b2] = pairings[i + 1]!.teams;
    const original = score(a1, b1) + score(a2, b2);
    const swapped = score(a1, b2) + score(a2, b1);
    deltas.push(swapped - original);
  }

  // DP over swaps: choose non-adjacent indices minimising sum (only negatives help).
  const n = deltas.length;
  const best: number[] = new Array(n + 1).fill(0);
  const take: boolean[] = new Array(n).fill(false);
  // best[i] = min total using swaps among indices >= i
  for (let i = n - 1; i >= 0; i--) {
    const skip = best[i + 1]!;
    const withSwap = Math.min(deltas[i]!, 0) + (i + 2 <= n ? best[i + 2]! : 0);
    if (deltas[i]! < 0 && withSwap < skip) {
      best[i] = withSwap;
      take[i] = true;
    } else {
      best[i] = skip;
      take[i] = false;
    }
  }

  let swaps = 0;
  for (let i = 0; i < n; ) {
    if (take[i]) {
      const p1 = pairings[i]!;
      const p2 = pairings[i + 1]!;
      const b1 = p1.teams[1];
      p1.teams[1] = p2.teams[1];
      p2.teams[1] = b1;
      for (const p of [p1, p2]) {
        if (!p.flags.includes("one_up_one_down")) p.flags.push("one_up_one_down");
      }
      swaps++;
      i += 2;
    } else {
      i += 1;
    }
  }
  return swaps;
}
