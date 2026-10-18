import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  ballots,
  byes,
  competitionTimeslots,
  debates,
  divisions,
  institutions,
  normalizeCompetitionConfig,
  roomAvailability,
  rooms,
  rounds,
  teamAvailability,
  teams,
  venues,
} from "@/db/schema";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import type { DrawGenerationInput, DrawTeam } from "./types";

export type DrawInputContext = DrawGenerationInput & {
  round: typeof rounds.$inferSelect;
  competitionId: string;
  /** Active teams excluded from this round by availability. */
  unavailableTeamIds: string[];
};

/**
 * Build the generator input for a round from the database, including each
 * team's history (opponents met, sides, pullups, draw strength) computed from
 * earlier published rounds and their confirmed ballots.
 */
export async function loadDrawInput(roundId: string): Promise<DrawInputContext> {
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");
  const config = normalizeCompetitionConfig(competition.config);

  const [
    teamRows,
    teamAvail,
    roomRows,
    roomAvail,
    venueRows,
    slotRows,
    divisionRows,
    institutionRows,
    priorRounds,
  ] = await Promise.all([
    db
      .select()
      .from(teams)
      .where(and(eq(teams.competitionId, competition.id), eq(teams.status, "active"))),
    db.select().from(teamAvailability).where(eq(teamAvailability.roundId, round.id)),
    db.select().from(rooms),
    db.select().from(roomAvailability).where(eq(roomAvailability.roundId, round.id)),
    db.select().from(venues).where(eq(venues.status, "active")),
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id))
      .orderBy(asc(competitionTimeslots.sortOrder), asc(competitionTimeslots.startsAt)),
    db.select().from(divisions).where(eq(divisions.competitionId, competition.id)),
    db.select().from(institutions),
    db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.competitionId, competition.id),
          lt(rounds.number, round.number),
          eq(rounds.drawStatus, "published")
        )
      )
      .orderBy(asc(rounds.number)),
  ]);

  const unavailableTeamIds = teamAvail.filter((r) => !r.available).map((r) => r.teamId);
  const unavailable = new Set(unavailableTeamIds);
  const availableTeams = teamRows.filter((t) => !unavailable.has(t.id));

  const roundUnavailableRooms = new Set(
    roomAvail.filter((r) => !r.available).map((r) => r.roomId)
  );
  const venueIds = new Set(venueRows.map((v) => v.id));
  const availableRooms = roomRows.filter(
    (r) => r.available && !roundUnavailableRooms.has(r.id) && venueIds.has(r.venueId)
  );

  const institutionMap = new Map(institutionRows.map((i) => [i.id, i]));

  // --- History from earlier published rounds -------------------------------
  const priorRoundIds = priorRounds.map((r) => r.id);
  const priorDebates = priorRoundIds.length
    ? await db.select().from(debates).where(inArray(debates.roundId, priorRoundIds))
    : [];
  const priorDebateIds = priorDebates.map((d) => d.id);
  const confirmed = priorDebateIds.length
    ? await db
        .select()
        .from(ballots)
        .where(
          and(
            inArray(ballots.debateId, priorDebateIds),
            eq(ballots.status, "accepted"),
            eq(ballots.discarded, false)
          )
        )
    : [];
  const priorByes = priorRoundIds.length
    ? await db.select().from(byes).where(inArray(byes.roundId, priorRoundIds))
    : [];

  const resultByDebate = new Map(confirmed.map((b) => [b.debateId, b]));
  const roundOrder = new Map(priorRounds.map((r) => [r.id, r.number]));

  type Hist = {
    history: Record<string, number>;
    aff: number;
    neg: number;
    pullups: number;
    wins: number;
    speaks: number;
    byes: number;
    opponents: string[];
  };
  const hist = new Map<string, Hist>();
  const h = (id: string) => {
    let v = hist.get(id);
    if (!v) {
      v = { history: {}, aff: 0, neg: 0, pullups: 0, wins: 0, speaks: 0, byes: 0, opponents: [] };
      hist.set(id, v);
    }
    return v;
  };

  const sortedDebates = [...priorDebates].sort(
    (a, b) => (roundOrder.get(a.roundId) ?? 0) - (roundOrder.get(b.roundId) ?? 0)
  );
  // Walk rounds in order so pullup detection uses wins as they stood at the time.
  let currentRound: string | null = null;
  let winsSnapshot = new Map<string, number>();
  for (const d of sortedDebates) {
    if (d.roundId !== currentRound) {
      currentRound = d.roundId;
      winsSnapshot = new Map([...hist.entries()].map(([id, v]) => [id, v.wins]));
    }
    if (!d.affirmativeTeamId || !d.negativeTeamId) continue;
    const aff = h(d.affirmativeTeamId);
    const neg = h(d.negativeTeamId);
    aff.history[d.negativeTeamId] = (aff.history[d.negativeTeamId] ?? 0) + 1;
    neg.history[d.affirmativeTeamId] = (neg.history[d.affirmativeTeamId] ?? 0) + 1;
    aff.aff++;
    neg.neg++;
    aff.opponents.push(d.negativeTeamId);
    neg.opponents.push(d.affirmativeTeamId);

    const flags = (d.flags ?? []) as string[];
    if ((flags.includes("pullup") || d.isPullUp) && d.bracket != null) {
      const affWins = winsSnapshot.get(d.affirmativeTeamId) ?? 0;
      const negWins = winsSnapshot.get(d.negativeTeamId) ?? 0;
      if (affWins < negWins) aff.pullups++;
      else if (negWins < affWins) neg.pullups++;
      else if (affWins < d.bracket) {
        aff.pullups++;
        neg.pullups++;
      }
    }

    const ballot = resultByDebate.get(d.id);
    if (ballot) {
      if (ballot.winnerTeamId === d.affirmativeTeamId) aff.wins++;
      else if (ballot.winnerTeamId === d.negativeTeamId) neg.wins++;
      aff.speaks += ballot.affirmativePoints ?? 0;
      neg.speaks += ballot.negativePoints ?? 0;
    }
  }
  for (const b of priorByes) h(b.teamId).byes++;

  const drawTeams: DrawTeam[] = availableTeams.map((t) => {
    const v = hist.get(t.id);
    const opponents = v?.opponents ?? [];
    return {
      id: t.id,
      name: formatTeamDisplayName(t, t.institutionId ? institutionMap.get(t.institutionId) : null),
      institutionId: t.institutionId,
      divisionId: t.divisionId,
      venueId: t.venueId,
      timeslotId: t.timeslotId,
      wins: t.wins,
      losses: t.losses,
      byes: t.byes,
      speaks: t.speakerPoints,
      pullups: v?.pullups ?? 0,
      affCount: v?.aff ?? 0,
      negCount: v?.neg ?? 0,
      history: v?.history ?? {},
      drawStrengthWins: opponents.reduce((sum, id) => sum + (hist.get(id)?.wins ?? 0), 0),
      drawStrengthSpeaks: opponents.reduce((sum, id) => sum + (hist.get(id)?.speaks ?? 0), 0),
    };
  });

  return {
    round,
    competitionId: competition.id,
    unavailableTeamIds,
    teams: drawTeams,
    rooms: availableRooms.map((r) => ({ id: r.id, venueId: r.venueId, identifier: r.identifier })),
    timeslots: slotRows.map((s) => ({ id: s.id, startsAt: s.startsAt, sortOrder: s.sortOrder })),
    venues: venueRows.map((v) => ({ id: v.id, name: v.name })),
    divisions: divisionRows.map((d) => ({ id: d.id, name: d.name })),
    config,
    roundNumber: round.number,
  };
}
