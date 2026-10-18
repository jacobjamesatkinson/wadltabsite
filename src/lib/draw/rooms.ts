import type { DrawIssue, DrawRoom, GeneratedDebate } from "./types";

/**
 * Assign rooms per (venue, timeslot) using only rooms that belong to that venue.
 * Debates are filled in bracket/roomRank order (top bracket → first room).
 */
export function assignRooms(
  debates: GeneratedDebate[],
  rooms: DrawRoom[],
  labels: { venue: (id: string) => string; timeslot: (id: string) => string }
): DrawIssue[] {
  const issues: DrawIssue[] = [];
  const roomsByVenue = new Map<string, DrawRoom[]>();
  for (const room of rooms) {
    const list = roomsByVenue.get(room.venueId) ?? [];
    list.push(room);
    roomsByVenue.set(room.venueId, list);
  }
  for (const list of roomsByVenue.values()) {
    list.sort((a, b) =>
      a.identifier.localeCompare(b.identifier, undefined, { numeric: true })
    );
  }

  const byVenueSlot = new Map<string, GeneratedDebate[]>();
  for (const d of debates) {
    const key = `${d.venueId}|${d.timeslotId}`;
    const list = byVenueSlot.get(key) ?? [];
    list.push(d);
    byVenueSlot.set(key, list);
  }

  for (const [key, list] of byVenueSlot) {
    const [venueId, timeslotId] = key.split("|") as [string, string];
    const venueRooms = roomsByVenue.get(venueId) ?? [];
    list.sort((a, b) => b.bracket - a.bracket || a.roomRank - b.roomRank);

    if (venueRooms.length === 0) {
      issues.push({
        code: "no_rooms_for_venue",
        severity: "fatal",
        message: `${labels.venue(venueId)} has no available rooms but needs ${list.length} for ${labels.timeslot(timeslotId)}`,
        venueId,
        timeslotId,
        fixHref: "/admin/venues",
      });
      continue;
    }
    if (list.length > venueRooms.length) {
      issues.push({
        code: "room_shortfall",
        severity: "fatal",
        message: `${labels.venue(venueId)} needs ${list.length} rooms at ${labels.timeslot(timeslotId)} but only ${venueRooms.length} are available`,
        venueId,
        timeslotId,
        fixHref: "/admin/venues",
      });
    }

    list.forEach((debate, index) => {
      debate.roomId = venueRooms[index]?.id ?? null;
    });
  }

  return issues;
}
