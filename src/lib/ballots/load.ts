import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  ballots,
  institutions,
  normalizeCompetitionConfig,
  speakerScores,
  speakers,
  teams,
  user,
  type ScoreConfig,
} from "@/db/schema";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { fromHundredths } from "./validate";

export type BallotSpeaker = { id: string; name: string };

export type BallotTeam = {
  id: string;
  name: string;
  speakers: BallotSpeaker[];
};

export type BallotVersion = {
  id: string;
  version: number;
  status: string;
  discarded: boolean;
  enteredBy: string;
  enteredAt: string;
  confirmedBy: string | null;
  winnerTeamId: string | null;
  affTotal: number | null;
  negTotal: number | null;
  feedback: string | null;
  speeches: {
    affirmative: Array<{ position: number; speakerId: string | null; score: number; ghost: boolean }>;
    negative: Array<{ position: number; speakerId: string | null; score: number; ghost: boolean }>;
  };
};

export type BallotDebate = {
  id: string;
  roundId: string;
  roundName: string;
  venue: string;
  timeslot: string;
  room: string;
  affirmative: BallotTeam | null;
  negative: BallotTeam | null;
  adjudicators: Array<{ id: string; name: string; role: string }>;
  scores: ScoreConfig;
  versions: BallotVersion[];
  /** The live (non-discarded) ballot, confirmed or awaiting confirmation. */
  current: BallotVersion | null;
};

export async function loadBallotDebate(debateId: string): Promise<BallotDebate | null> {
  const debate = await db.query.debates.findFirst({ where: (t, { eq: e }) => e(t.id, debateId) });
  if (!debate) return null;
  const round = await db.query.rounds.findFirst({ where: (t, { eq: e }) => e(t.id, debate.roundId) });
  if (!round) return null;
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) return null;
  const config = normalizeCompetitionConfig(competition.config);

  const teamIds = [debate.affirmativeTeamId, debate.negativeTeamId].filter(Boolean) as string[];
  const [teamRows, speakerRows, institutionRows, ballotRows, assignmentRows, profiles, users, venueRow, roomRow, slotRow] =
    await Promise.all([
      teamIds.length ? db.select().from(teams).where(inArray(teams.id, teamIds)) : Promise.resolve([]),
      teamIds.length
        ? db.select().from(speakers).where(inArray(speakers.teamId, teamIds)).orderBy(asc(speakers.name))
        : Promise.resolve([]),
      db.select().from(institutions),
      db.select().from(ballots).where(eq(ballots.debateId, debateId)),
      db.select().from(adjudicatorAssignments).where(eq(adjudicatorAssignments.debateId, debateId)),
      db.select().from(adjudicatorProfiles),
      db.select({ id: user.id, name: user.name }).from(user),
      debate.venueId ? db.query.venues.findFirst({ where: (t, { eq: e }) => e(t.id, debate.venueId!) }) : Promise.resolve(null),
      debate.roomId ? db.query.rooms.findFirst({ where: (t, { eq: e }) => e(t.id, debate.roomId!) }) : Promise.resolve(null),
      debate.timeslotId
        ? db.query.competitionTimeslots.findFirst({ where: (t, { eq: e }) => e(t.id, debate.timeslotId!) })
        : Promise.resolve(null),
    ]);

  const ballotIds = ballotRows.map((b) => b.id);
  const scoreRows = ballotIds.length
    ? await db.select().from(speakerScores).where(inArray(speakerScores.ballotId, ballotIds))
    : [];

  const institutionMap = new Map(institutionRows.map((i) => [i.id, i]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(profiles.map((p) => [p.id, userName.get(p.userId) ?? p.id]));

  const toTeam = (id: string | null): BallotTeam | null => {
    if (!id) return null;
    const t = teamRows.find((x) => x.id === id);
    if (!t) return null;
    return {
      id: t.id,
      name: formatTeamDisplayName(t, t.institutionId ? institutionMap.get(t.institutionId) : null),
      speakers: speakerRows
        .filter((s) => s.teamId === t.id && s.status === "active")
        .map((s) => ({ id: s.id, name: s.name })),
    };
  };

  const versions: BallotVersion[] = ballotRows
    .sort((a, b) => b.version - a.version)
    .map((b) => {
      const mine = scoreRows.filter((s) => s.ballotId === b.id);
      const side = (teamId: string | null) =>
        mine
          .filter((s) => s.teamId === teamId)
          .sort((x, y) => x.position - y.position)
          .map((s) => ({ position: s.position, speakerId: s.speakerId, score: fromHundredths(s.scoreHundredths), ghost: s.ghost }));
      return {
        id: b.id,
        version: b.version,
        status: b.status,
        discarded: b.discarded,
        enteredBy:
          (b.adjudicatorId ? adjName.get(b.adjudicatorId) : null) ??
          userName.get(b.submittedByUserId ?? "") ??
          "Unknown",
        enteredAt: b.createdAt.toLocaleString("en-AU", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
        confirmedBy: b.confirmedBy ? userName.get(b.confirmedBy) ?? null : null,
        winnerTeamId: b.winnerTeamId,
        affTotal: b.affirmativePoints,
        negTotal: b.negativePoints,
        feedback: b.feedback,
        speeches: { affirmative: side(debate.affirmativeTeamId), negative: side(debate.negativeTeamId) },
      };
    });

  const current =
    versions.find((v) => !v.discarded && v.status === "accepted") ??
    versions.find((v) => !v.discarded && v.status === "submitted") ??
    null;

  return {
    id: debate.id,
    roundId: round.id,
    roundName: round.name,
    venue: venueRow?.name ?? "—",
    timeslot: slotRow ? formatTimeslotTime(slotRow.startsAt) : "—",
    room: roomRow?.identifier ?? "—",
    affirmative: toTeam(debate.affirmativeTeamId),
    negative: toTeam(debate.negativeTeamId),
    adjudicators: assignmentRows.map((a) => ({ id: a.adjudicatorId, name: adjName.get(a.adjudicatorId) ?? a.adjudicatorId, role: a.role })),
    scores: config.scores,
    versions,
    current,
  };
}
