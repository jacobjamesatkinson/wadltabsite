"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adjudicatorAvailability,
  adjudicatorProfiles,
  competitionTimeslots,
  roomAvailability,
  rooms,
  teamAvailability,
  teams,
  user,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function setTeamAvailability(
  roundId: string,
  teamId: string,
  available: boolean
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const [existing] = await db
    .select()
    .from(teamAvailability)
    .where(eq(teamAvailability.teamId, teamId));

  const match = (
    await db.select().from(teamAvailability).where(eq(teamAvailability.roundId, roundId))
  ).find((r) => r.teamId === teamId);

  if (match) {
    await db
      .update(teamAvailability)
      .set({ available })
      .where(eq(teamAvailability.id, match.id));
  } else {
    await db.insert(teamAvailability).values({
      id: createId("tav"),
      teamId,
      roundId,
      available,
    });
  }

  void existing;
  revalidatePath(`/admin/rounds/${roundId}/availability`);
  revalidatePath(`/admin/rounds/${roundId}/draw`);
}

export async function setRoomAvailability(
  roundId: string,
  roomId: string,
  available: boolean
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const rows = await db
    .select()
    .from(roomAvailability)
    .where(eq(roomAvailability.roundId, roundId));
  const match = rows.find((r) => r.roomId === roomId);

  if (match) {
    await db
      .update(roomAvailability)
      .set({ available })
      .where(eq(roomAvailability.id, match.id));
  } else {
    await db.insert(roomAvailability).values({
      id: createId("rav"),
      roomId,
      roundId,
      available,
    });
  }

  revalidatePath(`/admin/rounds/${roundId}/availability`);
  revalidatePath(`/admin/rounds/${roundId}/draw`);
}

async function roundTimeslots(roundId: string) {
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");
  return db
    .select()
    .from(competitionTimeslots)
    .where(eq(competitionTimeslots.competitionId, round.competitionId))
    .orderBy(asc(competitionTimeslots.sortOrder), asc(competitionTimeslots.startsAt));
}

/** Set adjudicator availability for one round + competition timeslot. */
export async function setAdjudicatorTimeslotAvailability(
  roundId: string,
  adjudicatorId: string,
  timeslotId: string,
  available: boolean
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.id, adjudicatorId),
  });
  if (!profile) throw new Error("NOT_FOUND");
  if (profile.userId !== ctx.userId && !hasPermission(ctx, "adjudicators:manage")) {
    throw new Error("FORBIDDEN");
  }

  const existing = await db.query.adjudicatorAvailability.findFirst({
    where: (t, { and: a, eq: e }) =>
      a(e(t.adjudicatorId, adjudicatorId), e(t.roundId, roundId), e(t.timeslotId, timeslotId)),
  });
  if (existing) {
    await db
      .update(adjudicatorAvailability)
      .set({ available })
      .where(eq(adjudicatorAvailability.id, existing.id));
  } else {
    await db.insert(adjudicatorAvailability).values({
      id: createId("aav"),
      adjudicatorId,
      roundId,
      timeslotId,
      available,
    });
  }

  revalidatePath(`/admin/rounds/${roundId}/availability`);
  revalidatePath(`/admin/rounds/${roundId}/adjudicators`);
  revalidatePath("/adjudicator/availability");
}

/** Toggle adjudicator availability for every timeslot in the round. */
export async function setAdjudicatorRoundAvailability(
  roundId: string,
  adjudicatorId: string,
  available: boolean
) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "adjudicators:manage");

  const slots = await roundTimeslots(roundId);
  for (const slot of slots) {
    await setAdjudicatorTimeslotAvailability(roundId, adjudicatorId, slot.id, available);
  }
  revalidatePath(`/admin/rounds/${roundId}/availability`);
}

export type AvailabilityItem = {
  id: string;
  name: string;
  available: boolean;
};

export async function loadRoundAvailability(roundId: string): Promise<{
  teams: AvailabilityItem[];
  rooms: AvailabilityItem[];
  adjudicators: AvailabilityItem[];
}> {
  const [teamRows, roomRows, adjRows, users, teamAvail, roomAvail, adjAvail] =
    await Promise.all([
      db.select().from(teams).where(eq(teams.status, "active")),
      db.select().from(rooms),
      db.select().from(adjudicatorProfiles).where(eq(adjudicatorProfiles.active, true)),
      db.select({ id: user.id, name: user.name }).from(user),
      db.select().from(teamAvailability).where(eq(teamAvailability.roundId, roundId)),
      db.select().from(roomAvailability).where(eq(roomAvailability.roundId, roundId)),
      db
        .select()
        .from(adjudicatorAvailability)
        .where(and(eq(adjudicatorAvailability.roundId, roundId))),
    ]);

  const userName = new Map(users.map((u) => [u.id, u.name]));
  const teamAvailMap = new Map(teamAvail.map((a) => [a.teamId, a.available]));
  const roomAvailMap = new Map(roomAvail.map((a) => [a.roomId, a.available]));

  const adjFalse = new Set(
    adjAvail.filter((a) => !a.available).map((a) => a.adjudicatorId)
  );

  return {
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      available: teamAvailMap.get(t.id) ?? true,
    })),
    rooms: roomRows.map((r) => ({
      id: r.id,
      name: r.identifier,
      available: roomAvailMap.get(r.id) ?? r.available,
    })),
    adjudicators: adjRows.map((a) => ({
      id: a.id,
      name: userName.get(a.userId) ?? a.id,
      available: !adjFalse.has(a.id),
    })),
  };
}
