import { cache } from "react";
import { and, eq, inArray, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  ballots,
  competitionTimeslots,
  debates,
  rooms,
  rounds,
  speakerDeletionRequests,
  speakerScores,
  speakers,
  teamAccessTokens,
  user,
  venues,
} from "@/db/schema";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { isRosterDay, rosterDayDate, formatDisplayDate, formatLocalDate } from "@/lib/roster/dates";
import { hashToken } from "@/lib/tokens";

export type TeamPortalContext = {
  rawToken: string;
  token: typeof teamAccessTokens.$inferSelect;
  team: NonNullable<Awaited<ReturnType<typeof db.query.teams.findFirst>>>;
  institution: { id: string; name: string; shortName: string } | null;
  displayName: string;
  canEditSpeakers: boolean;
};

export const loadTeamPortal = cache(
  async (rawToken: string): Promise<TeamPortalContext> => {
    const token = await db.query.teamAccessTokens.findFirst({
      where: (t, { eq: e }) => e(t.tokenHash, hashToken(rawToken)),
    });
    if (!token || token.revokedAt) notFound();

    await db
      .update(teamAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(teamAccessTokens.id, token.id));

    const team = await db.query.teams.findFirst({
      where: (t, { eq: e }) => e(t.id, token.teamId),
    });
    if (!team) notFound();

    const institution = team.institutionId
      ? ((await db.query.institutions.findFirst({
          where: (t, { eq: e }) => e(t.id, team.institutionId!),
          columns: { id: true, name: true, shortName: true },
        })) ?? null)
      : null;

    return {
      rawToken,
      token,
      team,
      institution,
      displayName: formatTeamDisplayName(team, institution),
      canEditSpeakers: token.canEditSpeakers,
    };
  }
);

function asLocalNoon(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    12,
    0,
    0,
    0
  );
}

export type TeamPortalDrawRow = {
  id: string;
  roundName: string;
  roundNumber: number;
  date: string;
  dateSort: string;
  venue: string;
  timeslot: string;
  timeslotSort: number;
  room: string;
  side: "Affirmative" | "Negative";
  opponent: string;
  adjudicators: string;
};

export async function loadTeamPortalDraw(teamId: string): Promise<TeamPortalDrawRow[]> {
  const published = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = published.map((r) => r.id);
  if (publishedIds.length === 0) return [];

  const debateRows = await db
    .select()
    .from(debates)
    .where(
      and(
        inArray(debates.roundId, publishedIds),
        or(eq(debates.affirmativeTeamId, teamId), eq(debates.negativeTeamId, teamId))
      )
    );

  if (debateRows.length === 0) return [];

  const debateIds = debateRows.map((d) => d.id);
  const [venueRows, roomRows, slotRows, assignments, profiles, users] =
    await Promise.all([
      db.select().from(venues),
      db.select().from(rooms),
      db.select().from(competitionTimeslots),
      db
        .select()
        .from(adjudicatorAssignments)
        .where(inArray(adjudicatorAssignments.debateId, debateIds)),
      db.select().from(adjudicatorProfiles),
      db.select({ id: user.id, name: user.name }).from(user),
    ]);

  const roundMap = new Map(published.map((r) => [r.id, r]));
  const venueMap = new Map(venueRows.map((v) => [v.id, v]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(
    profiles.map((p) => [p.id, userName.get(p.userId) ?? p.id])
  );
  const adjsByDebate = new Map<string, string[]>();
  for (const a of assignments) {
    const list = adjsByDebate.get(a.debateId) ?? [];
    list.push(adjName.get(a.adjudicatorId) ?? a.adjudicatorId);
    adjsByDebate.set(a.debateId, list);
  }

  return debateRows
    .map((d) => {
      const round = roundMap.get(d.roundId);
      const room = d.roomId ? roomMap.get(d.roomId) : undefined;
      const venueRow =
        (d.venueId ? venueMap.get(d.venueId) : undefined) ??
        (room ? venueMap.get(room.venueId) : undefined);
      const slot = d.timeslotId ? slotMap.get(d.timeslotId) : undefined;
      const side: "Affirmative" | "Negative" =
        d.affirmativeTeamId === teamId ? "Affirmative" : "Negative";
      const opponent =
        side === "Affirmative"
          ? (d.negativeTeamName ?? "—")
          : (d.affirmativeTeamName ?? "—");

      let debateDate: Date | null = round?.date ?? null;
      const rosterDay = venueRow?.rosterDay ?? null;
      if (round?.date && rosterDay && isRosterDay(rosterDay)) {
        debateDate = rosterDayDate(asLocalNoon(round.date), rosterDay);
      } else if (round?.date) {
        debateDate = asLocalNoon(round.date);
      }

      return {
        id: d.id,
        roundName: round?.name ?? "—",
        roundNumber: round?.number ?? 0,
        date: debateDate ? formatDisplayDate(debateDate) : "—",
        dateSort: debateDate ? formatLocalDate(debateDate) : "",
        venue: venueRow?.name ?? "—",
        timeslot: slot ? formatTimeslotTime(slot.startsAt) : "—",
        timeslotSort: slot?.sortOrder ?? 999,
        room: room?.identifier ?? "—",
        side,
        opponent,
        adjudicators: (adjsByDebate.get(d.id) ?? []).join(", ") || "—",
      };
    })
    .sort(
      (a, b) =>
        a.roundNumber - b.roundNumber ||
        a.dateSort.localeCompare(b.dateSort) ||
        a.timeslotSort - b.timeslotSort
    );
}

export type TeamPortalResultRow = {
  id: string;
  roundName: string;
  roundNumber: number;
  opponent: string;
  outcome: "won" | "lost";
  margin: number | null;
};

export async function loadTeamPortalResults(
  teamId: string
): Promise<TeamPortalResultRow[]> {
  const debateRows = await db.query.debates.findMany({
    where: (t, { or, eq: e }) =>
      or(e(t.affirmativeTeamId, teamId), e(t.negativeTeamId, teamId)),
  });
  if (debateRows.length === 0) return [];

  const debateIds = debateRows.map((d) => d.id);
  const [ballotRows, roundRows] = await Promise.all([
    db
      .select()
      .from(ballots)
      .where(
        and(
          inArray(ballots.debateId, debateIds),
          eq(ballots.status, "accepted"),
          eq(ballots.discarded, false)
        )
      ),
    db.select().from(rounds),
  ]);

  const roundMap = new Map(roundRows.map((r) => [r.id, r]));
  const confirmed = new Map<string, (typeof ballotRows)[number]>();
  for (const b of ballotRows) {
    const prev = confirmed.get(b.debateId);
    if (!prev || b.version > prev.version) confirmed.set(b.debateId, b);
  }

  const rows: TeamPortalResultRow[] = [];
  for (const d of debateRows) {
    const ballot = confirmed.get(d.id);
    if (!ballot?.winnerTeamId) continue;
    const round = roundMap.get(d.roundId);
    const sideAff = d.affirmativeTeamId === teamId;
    const opponent = sideAff
      ? (d.negativeTeamName ?? "—")
      : (d.affirmativeTeamName ?? "—");
    rows.push({
      id: d.id,
      roundName: round?.name ?? "—",
      roundNumber: round?.number ?? 0,
      opponent,
      outcome: ballot.winnerTeamId === teamId ? "won" : "lost",
      margin: ballot.margin ?? null,
    });
  }

  return rows.sort((a, b) => a.roundNumber - b.roundNumber);
}

export type TeamPortalSpeaker = {
  id: string;
  name: string;
  onBallot: boolean;
  deletionPending: boolean;
};

export async function loadTeamPortalSpeakers(
  teamId: string
): Promise<TeamPortalSpeaker[]> {
  const [speakerRows, scoreRows, pendingDeletes] = await Promise.all([
    db.select().from(speakers).where(eq(speakers.teamId, teamId)),
    db
      .select({ speakerId: speakerScores.speakerId })
      .from(speakerScores)
      .where(eq(speakerScores.teamId, teamId)),
    db
      .select()
      .from(speakerDeletionRequests)
      .where(
        and(
          eq(speakerDeletionRequests.teamId, teamId),
          eq(speakerDeletionRequests.status, "pending")
        )
      ),
  ]);

  const onBallot = new Set(
    scoreRows.map((s) => s.speakerId).filter((id): id is string => Boolean(id))
  );
  const pending = new Set(pendingDeletes.map((r) => r.speakerId));

  return speakerRows
    .map((s) => ({
      id: s.id,
      name: s.name,
      onBallot: onBallot.has(s.id),
      deletionPending: pending.has(s.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
