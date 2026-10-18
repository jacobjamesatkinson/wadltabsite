import type { SideAllocation } from "@/db/schema";
import type { Pairing, Rng } from "./types";

/**
 * Tabbycat side allocation.
 * - random: coin flip.
 * - balance: the team that has affirmed less so far takes the affirmative; tie → random.
 */
export function allocateSides(pairings: Pairing[], method: SideAllocation, rng: Rng) {
  for (const pairing of pairings) {
    const [a, b] = pairing.teams;
    if (method === "balance") {
      if (a.affCount < b.affCount) pairing.affIndex = 0;
      else if (a.affCount > b.affCount) pairing.affIndex = 1;
      else pairing.affIndex = rng() < 0.5 ? 0 : 1;
    } else {
      pairing.affIndex = rng() < 0.5 ? 0 : 1;
    }
  }
}
