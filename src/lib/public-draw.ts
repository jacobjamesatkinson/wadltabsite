import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  competitionTimeslots,
  debates,
  divisions,
  institutions,
  rooms,
  rounds,
  teams,
  user,
  venues,
} from "@/db/schema";
import type { PublicDrawRow, RoundMenuItem } from "@/app/public/draw/types";
import {
  formatDisplayDate,
  formatLocalDate,
  isRosterDay,
  rosterDayDate,
} from "@/lib/roster/dates";
import { formatTimeslotTime } from "@/lib/timeslots/format";

/** Rebuild as local noon so roster-day offsets stay on the correct calendar day. */
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

/**
 * Venue debate night = round Monday start + venue roster-day offset
 * (e.g. Mon 19 Oct + Wednesday A → Wed 21 Oct).
 */
function venueDebateDate(
  roundStart: Date | null | undefined,
  rosterDay: string | null | undefined
): Date | null {
  if (!roundStart) return null;
  const monday = asLocalNoon(roundStart);
  if (!rosterDay) return monday;
  try {
    return rosterDayDate(monday, rosterDay);
  } catch {
    return monday;
  }
}

export async function loadPublicDrawData() {
  const publishedRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = publishedRounds.map((r) => r.id);

  const [
    debateRows,
    venueRows,
    slotRows,
    divisionRows,
    roomRows,
    teamRows,
    institutionRows,
    assignments,
    adjProfiles,
    users,
  ] = await Promise.all([
    publishedIds.length
      ? db.select().from(debates).where(inArray(debates.roundId, publishedIds))
      : Promise.resolve([]),
    db.select().from(venues),
    db.select().from(competitionTimeslots),
    db.select().from(divisions),
    db.select().from(rooms),
    db.select({ id: teams.id, institutionId: teams.institutionId }).from(teams),
    db.select({ id: institutions.id, name: institutions.name }).from(institutions),
    db.select().from(adjudicatorAssignments),
    db.select().from(adjudicatorProfiles),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);

  const venueMap = new Map(venueRows.map((v) => [v.id, v]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const roundMap = new Map(publishedRounds.map((r) => [r.id, r]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
  const institutionName = new Map(institutionRows.map((i) => [i.id, i.name]));
  const teamInstitution = new Map(
    teamRows.map((t) => [
      t.id,
      t.institutionId ? institutionName.get(t.institutionId) ?? null : null,
    ])
  );
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(
    adjProfiles.map((a) => [a.id, userName.get(a.userId) ?? a.id])
  );

  const adjsByDebate = new Map<string, string[]>();
  for (const a of assignments) {
    const list = adjsByDebate.get(a.debateId) ?? [];
    list.push(adjName.get(a.adjudicatorId) ?? a.adjudicatorId);
    adjsByDebate.set(a.debateId, list);
  }

  const rows: PublicDrawRow[] = debateRows.map((d) => {
    const slot = d.timeslotId ? slotMap.get(d.timeslotId) : undefined;
    const round = roundMap.get(d.roundId);
    const room = d.roomId ? roomMap.get(d.roomId) : undefined;
    const venueRow =
      (d.venueId ? venueMap.get(d.venueId) : undefined) ??
      (room ? venueMap.get(room.venueId) : undefined);
    const venue = venueRow?.name ?? "Unassigned venue";
    // Older imports put roster labels in `address` and left `roster_day` null.
    const addressRaw = venueRow?.address?.trim() || "";
    const rosterDay =
      venueRow?.rosterDay ??
      (isRosterDay(addressRaw) ? addressRaw : null);
    const venueAddress = isRosterDay(addressRaw) ? "" : addressRaw;
    const debateDate = venueDebateDate(round?.date ?? null, rosterDay);
    const divisionId = d.divisionId ?? "unassigned";
    const institutionsForDebate = [
      d.affirmativeTeamId ? teamInstitution.get(d.affirmativeTeamId) : null,
      d.negativeTeamId ? teamInstitution.get(d.negativeTeamId) : null,
    ].filter((name): name is string => Boolean(name));
    return {
      id: d.id,
      venue,
      venueId: d.venueId ?? room?.venueId ?? null,
      venueAddress,
      room: room?.identifier ?? "—",
      date: debateDate ? formatDisplayDate(debateDate) : "—",
      dateSort: debateDate ? formatLocalDate(debateDate) : "",
      timeslot: slot ? formatTimeslotTime(slot.startsAt) : "—",
      timeslotSort: slot?.sortOrder ?? 999,
      timeslotId: d.timeslotId,
      affirmative: d.affirmativeTeamName ?? "—",
      negative: d.negativeTeamName ?? "—",
      institutions: [...new Set(institutionsForDebate)],
      adjudicators: (adjsByDebate.get(d.id) ?? []).join(", ") || "—",
      comments: d.notes?.trim() || "—",
      divisionId,
      divisionName: d.divisionId
        ? divMap.get(d.divisionId)?.name ?? "—"
        : "Unassigned",
      divisionSort: d.divisionId
        ? (divMap.get(d.divisionId)?.sortOrder ?? 999)
        : 999,
      divisionChipColor: d.divisionId
        ? (divMap.get(d.divisionId)?.chipColor ?? null)
        : null,
      roundId: d.roundId,
      roundName: round?.name ?? "—",
      roundNumber: round?.number ?? 0,
    };
  });

  const roundIdsWithDebates = new Set(rows.map((r) => r.roundId));
  const roundMenus: RoundMenuItem[] = publishedRounds
    .filter((r) => roundIdsWithDebates.has(r.id))
    .map((r) => ({ id: r.id, name: r.name, number: r.number }))
    .sort((a, b) => a.number - b.number);

  const venueOptions = [...new Set(rows.map((r) => r.venue))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((name) => ({ id: name, name }));

  return { rows, roundMenus, venueOptions, publishedRounds };
}
