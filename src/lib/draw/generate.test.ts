import { describe, expect, it } from "vitest";
import { defaultCompetitionConfig, type DrawOptions } from "@/db/schema";
import { generateDraw } from "./generate";
import { oneUpOneDown } from "./one-up-one-down";
import { pairBrackets, rawBrackets, resolveOddBrackets } from "./power-paired";
import { roundRobinPair } from "./other-generators";
import { createRng } from "./rng";
import type { DrawTeam, Pairing } from "./types";

const config = defaultCompetitionConfig;
const options = config.draw;

function team(
  id: string,
  wins: number,
  overrides: Partial<DrawTeam> = {}
): DrawTeam {
  return {
    id,
    name: `Team ${id}`,
    institutionId: `inst-${id}`,
    divisionId: "div1",
    venueId: "v1",
    timeslotId: "t1",
    wins,
    losses: 0,
    byes: 0,
    speaks: wins * 10,
    pullups: 0,
    affCount: 0,
    negCount: 0,
    history: {},
    drawStrengthWins: 0,
    drawStrengthSpeaks: 0,
    ...overrides,
  };
}

const baseInput = {
  rooms: Array.from({ length: 12 }, (_, i) => ({
    id: `r${i + 1}`,
    venueId: "v1",
    identifier: `${i + 1}`,
  })),
  timeslots: [{ id: "t1", startsAt: "18:00", sortOrder: 0 }],
  venues: [{ id: "v1", name: "Venue 1" }],
  divisions: [
    { id: "div1", name: "Division 1", sortOrder: 0, chipColor: null },
  ],
  config,
  roundNumber: 3,
};

/** Tabbycat test fixture: 12 teams with points and institutions, used for pullup tests. */
function tabbycatBrackets() {
  // points: [3: a,b,c] [2: d,e,f,g,h] [1: i,j,k] [0: l]
  return [
    team("a", 3), team("b", 3), team("c", 3),
    team("d", 2), team("e", 2), team("f", 2), team("g", 2), team("h", 2),
    team("i", 1), team("j", 1), team("k", 1),
    team("l", 0),
  ];
}

function bracketsFor(teams: DrawTeam[], method: DrawOptions["oddBracket"], restriction: DrawOptions["pullupRestriction"] = "none") {
  const opts: DrawOptions = { ...options, oddBracket: method, pullupRestriction: restriction };
  const pulledUp = new Set<string>();
  const brackets = resolveOddBrackets(rawBrackets(teams, config, opts), opts, createRng("x"), pulledUp);
  return { brackets, pulledUp, opts };
}

describe("odd bracket resolution (Tabbycat)", () => {
  it("pullup_top pulls the top team of the next bracket", () => {
    const { brackets, pulledUp } = bracketsFor(tabbycatBrackets(), "pullup_top");
    expect(brackets.map((b) => [b.points, b.teams.map((t) => t.id)])).toEqual([
      [3, ["a", "b", "c", "d"]],
      [2, ["e", "f", "g", "h"]],
      [1, ["i", "j", "k", "l"]],
    ]);
    expect([...pulledUp]).toEqual(["d", "l"]);
  });

  it("pullup_bottom pulls the bottom team of the next bracket", () => {
    const { brackets } = bracketsFor(tabbycatBrackets(), "pullup_bottom");
    expect(brackets.map((b) => b.teams.map((t) => t.id))).toEqual([
      ["a", "b", "c", "h"],
      ["d", "e", "f", "g"],
      ["i", "j", "k", "l"],
    ]);
  });

  it("intermediate brackets create half-point brackets", () => {
    const { brackets } = bracketsFor(tabbycatBrackets(), "intermediate");
    expect(brackets.map((b) => [b.points, b.teams.map((t) => t.id)])).toEqual([
      [3, ["a", "b"]],
      [2.5, ["c", "d"]],
      [2, ["e", "f", "g", "h"]],
      [1, ["i", "j"]],
      [0.5, ["k", "l"]],
    ]);
  });

  it("intermediate bubble swaps out a conflicting intermediate pairing", () => {
    const teams = tabbycatBrackets();
    // c and d have met; so d should be bubbled for e
    teams[2]!.history = { d: 1 };
    teams[3]!.history = { c: 1 };
    const { brackets } = bracketsFor(teams, "intermediate_bubble_up_down");
    const inter = brackets.find((b) => b.points === 2.5)!;
    expect(inter.teams.map((t) => t.id)).toEqual(["c", "e"]);
    const two = brackets.find((b) => b.points === 2)!;
    expect(two.teams.map((t) => t.id).sort()).toEqual(["d", "f", "g", "h"]);
  });

  it("least_to_date restriction skips teams already pulled up", () => {
    const teams = tabbycatBrackets();
    teams[3]!.pullups = 1; // d already pulled up → e should be chosen
    const { brackets } = bracketsFor(teams, "pullup_top", "least_to_date");
    expect(brackets[0]!.teams.map((t) => t.id)).toEqual(["a", "b", "c", "e"]);
  });
});

describe("pairing methods (Tabbycat)", () => {
  const even = [team("a", 1), team("b", 1), team("c", 1), team("d", 1), team("e", 1), team("f", 1)];
  const run = (method: DrawOptions["pairingMethod"]) => {
    const opts = { ...options, pairingMethod: method };
    return pairBrackets([{ points: 1, teams: even }], opts, createRng("p"), new Set()).flat();
  };
  const ids = (p: Pairing[]) => p.map((x) => x.teams.map((t) => t.id));

  it("fold pairs 1v6 2v5 3v4", () => {
    expect(ids(run("fold"))).toEqual([["a", "f"], ["b", "e"], ["c", "d"]]);
  });
  it("slide pairs 1v4 2v5 3v6", () => {
    expect(ids(run("slide"))).toEqual([["a", "d"], ["b", "e"], ["c", "f"]]);
  });
  it("adjacent pairs 1v2 3v4 5v6", () => {
    expect(ids(run("adjacent"))).toEqual([["a", "b"], ["c", "d"], ["e", "f"]]);
  });
  it("assigns sequential room ranks", () => {
    expect(run("slide").map((p) => p.roomRank)).toEqual([1, 2, 3]);
  });
});

describe("one-up-one-down (Tabbycat)", () => {
  const mk = (pairs: [DrawTeam, DrawTeam][]): Pairing[] =>
    pairs.map(([a, b], i) => ({ teams: [a, b], bracket: 1, roomRank: i + 1, flags: [], teamFlags: {}, affIndex: 0 }));

  it("swaps to avoid a rematch", () => {
    const a = team("a", 1, { history: { b: 1 } });
    const b = team("b", 1, { history: { a: 1 } });
    const c = team("c", 1);
    const d = team("d", 1);
    const pairings = mk([[a, b], [c, d]]);
    expect(oneUpOneDown(pairings, options)).toBe(1);
    expect(pairings.map((p) => p.teams.map((t) => t.id))).toEqual([["a", "d"], ["c", "b"]]);
    expect(pairings[0]!.flags).toContain("one_up_one_down");
  });

  it("swaps to avoid same institution when history is clear", () => {
    const a = team("a", 1, { institutionId: "X" });
    const b = team("b", 1, { institutionId: "X" });
    const c = team("c", 1, { institutionId: "Y" });
    const d = team("d", 1, { institutionId: "Z" });
    const pairings = mk([[a, b], [c, d]]);
    expect(oneUpOneDown(pairings, options)).toBe(1);
    expect(pairings.map((p) => p.teams.map((t) => t.id))).toEqual([["a", "d"], ["c", "b"]]);
  });

  it("never performs adjacent swaps", () => {
    const a = team("a", 1, { history: { b: 1 } });
    const b = team("b", 1, { history: { a: 1 } });
    const c = team("c", 1, { history: { d: 1 } });
    const d = team("d", 1, { history: { c: 1 } });
    const e = team("e", 1, { history: { f: 1 } });
    const f = team("f", 1, { history: { e: 1 } });
    const pairings = mk([[a, b], [c, d], [e, f]]);
    // Only one of the two possible swaps may be made (they overlap on pairing 2)
    expect(oneUpOneDown(pairings, options)).toBe(1);
  });

  it("does nothing when a swap would not improve things", () => {
    const pairings = mk([[team("a", 1), team("b", 1)], [team("c", 1), team("d", 1)]]);
    expect(oneUpOneDown(pairings, { ...options, avoidSameInstitution: false })).toBe(0);
  });
});

describe("round robin", () => {
  it("meets every opponent exactly once over n-1 rounds", () => {
    const teams = ["a", "b", "c", "d", "e", "f"].map((id) => team(id, 0));
    const met = new Map<string, Set<string>>();
    for (let r = 1; r <= 5; r++) {
      for (const p of roundRobinPair(teams, r)) {
        const [x, y] = p.teams;
        (met.get(x.id) ?? met.set(x.id, new Set()).get(x.id)!).add(y.id);
        (met.get(y.id) ?? met.set(y.id, new Set()).get(y.id)!).add(x.id);
      }
    }
    for (const t of teams) expect(met.get(t.id)?.size).toBe(5);
  });
});

describe("generateDraw", () => {
  it("never pairs teams across venues, timeslots or divisions", () => {
    const teams = [
      team("a", 1), team("b", 1),
      team("c", 1, { venueId: "v2" }), team("d", 1, { venueId: "v2" }),
      team("e", 1, { timeslotId: "t2" }), team("f", 1, { timeslotId: "t2" }),
      team("g", 1, { divisionId: "div2" }), team("h", 1, { divisionId: "div2" }),
    ];
    const result = generateDraw({
      ...baseInput,
      teams,
      rooms: [...baseInput.rooms, { id: "x1", venueId: "v2", identifier: "A" }],
      timeslots: [...baseInput.timeslots, { id: "t2", startsAt: "19:00", sortOrder: 1 }],
      venues: [...baseInput.venues, { id: "v2", name: "Venue 2" }],
      divisions: [
        ...baseInput.divisions,
        { id: "div2", name: "Division 2", sortOrder: 1, chipColor: null },
      ],
      seed: "partition",
    });
    expect(result.report.fatal).toBe(false);
    expect(result.debates).toHaveLength(4);
    for (const d of result.debates) {
      const aff = teams.find((t) => t.id === d.affirmativeTeamId)!;
      const neg = teams.find((t) => t.id === d.negativeTeamId)!;
      expect(aff.venueId).toBe(neg.venueId);
      expect(aff.timeslotId).toBe(neg.timeslotId);
      expect(aff.divisionId).toBe(neg.divisionId);
    }
    const v2 = result.debates.find((d) => d.venueId === "v2")!;
    expect(v2.roomId).toBe("x1");
  });

  it("gives a bye to the lowest-ranked team without a prior bye in odd groups", () => {
    const result = generateDraw({
      ...baseInput,
      teams: [team("a", 2), team("b", 1), team("c", 0), team("d", 0, { byes: 1 }), team("e", 0)],
      seed: "bye",
    });
    expect(result.byes).toHaveLength(1);
    expect(["c", "e"]).toContain(result.byes[0]!.teamId);
    expect(result.debates).toHaveLength(2);
  });

  it("reports fatal issues for teams missing venue/timeslot/division instead of throwing", () => {
    const result = generateDraw({
      ...baseInput,
      teams: [team("a", 1, { venueId: null }), team("b", 1, { timeslotId: null }), team("c", 1), team("d", 1)],
      seed: "fatal",
    });
    expect(result.report.fatal).toBe(true);
    expect(result.report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["team_missing_venue", "team_missing_timeslot"])
    );
    expect(result.debates).toHaveLength(1);
  });

  it("reports a room shortfall per venue", () => {
    const result = generateDraw({
      ...baseInput,
      rooms: [{ id: "r1", venueId: "v1", identifier: "1" }],
      teams: [team("a", 1), team("b", 1), team("c", 1), team("d", 1)],
      seed: "rooms",
    });
    expect(result.report.issues.some((i) => i.code === "room_shortfall")).toBe(true);
    expect(result.debates.filter((d) => d.roomId).length).toBe(1);
  });

  it("flags pullups and rematches", () => {
    const teams = tabbycatBrackets();
    teams[0]!.history = { b: 1 };
    teams[1]!.history = { a: 1 };
    const result = generateDraw({
      ...baseInput,
      teams,
      options: { conflictAvoidance: "off", pairingMethod: "adjacent" },
      seed: "flags",
    });
    expect(result.debates.some((d) => d.isPullUp)).toBe(true);
    expect(result.debates.some((d) => d.isRematch)).toBe(true);
    expect(result.report.issues.some((i) => i.code === "rematch")).toBe(true);
  });

  it("uses a random draw in round one", () => {
    const result = generateDraw({
      ...baseInput,
      roundNumber: 1,
      teams: [team("a", 0), team("b", 0), team("c", 0), team("d", 0)],
      seed: "r1",
    });
    expect(result.debates).toHaveLength(2);
    expect(result.debates.every((d) => d.bracket === 0)).toBe(true);
  });

  it("manual draws produce empty rooms", () => {
    const result = generateDraw({
      ...baseInput,
      teams: [team("a", 0), team("b", 0), team("c", 0), team("d", 0)],
      options: { type: "manual" },
      seed: "manual",
    });
    expect(result.debates).toHaveLength(2);
    expect(result.debates.every((d) => d.affirmativeTeamId === "" && d.flags.includes("manual"))).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const teams = tabbycatBrackets();
    const a = generateDraw({ ...baseInput, teams, seed: "same" });
    const b = generateDraw({ ...baseInput, teams, seed: "same" });
    expect(a.debates).toEqual(b.debates);
  });
});
