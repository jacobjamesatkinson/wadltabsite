import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  debates,
  divisions,
  rooms,
  rounds,
  timeslots,
  user,
  venues,
} from "@/db/schema";
import type { PublicDrawRow, RoundMenuItem } from "@/app/public/draw/types";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toSortableDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString();
}

export async function loadPublicDrawData() {
  const publishedRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = publishedRounds.map((r) => r.id);

  const [debateRows, venueRows, slotRows, divisionRows, roomRows, assignments, adjProfiles, users] =
    await Promise.all([
      publishedIds.length
        ? db.select().from(debates).where(inArray(debates.roundId, publishedIds))
        : Promise.resolve([]),
      db.select().from(venues),
      db.select().from(timeslots),
      db.select().from(divisions),
      db.select().from(rooms),
      db.select().from(adjudicatorAssignments),
      db.select().from(adjudicatorProfiles),
      db.select({ id: user.id, name: user.name }).from(user),
    ]);

  const venueMap = new Map(venueRows.map((v) => [v.id, v]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s]));
  const roundMap = new Map(publishedRounds.map((r) => [r.id, r]));
  const divMap = new Map(divisionRows.map((d) => [d.id, d]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r]));
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
    const debateDate = slot?.startsAt ?? round?.date ?? null;
    const room = d.roomId ? roomMap.get(d.roomId) : undefined;
    const venue =
      (d.venueId ? venueMap.get(d.venueId)?.name : undefined) ??
      (room ? venueMap.get(room.venueId)?.name : undefined) ??
      "Unassigned venue";
    const divisionId = d.divisionId ?? "unassigned";
    return {
      id: d.id,
      venue,
      venueId: d.venueId ?? room?.venueId ?? null,
      room: room?.identifier ?? "—",
      date: formatDate(debateDate),
      dateSort: toSortableDate(debateDate),
      timeslot: slot?.label ?? "—",
      timeslotSort: slot?.sortOrder ?? 999,
      timeslotId: d.timeslotId,
      affirmative: d.affirmativeTeamName ?? "—",
      negative: d.negativeTeamName ?? "—",
      adjudicators: (adjsByDebate.get(d.id) ?? []).join(", ") || "—",
      comments: d.notes?.trim() || "—",
      divisionId,
      divisionName: d.divisionId
        ? divMap.get(d.divisionId)?.name ?? "—"
        : "Unassigned",
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
    .sort()
    .map((name) => ({ id: name, name }));

  return { rows, roundMenus, venueOptions, publishedRounds };
}
