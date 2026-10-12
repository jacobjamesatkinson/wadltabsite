"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rooms, venues } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function createVenue(input: { name: string; address?: string }) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "venues:manage");
  const data = z
    .object({ name: z.string().min(1), address: z.string().optional() })
    .parse(input);
  const id = createId("ven");
  await db.insert(venues).values({
    id,
    name: data.name,
    address: data.address,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "venue.create",
    entityType: "venue",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/venues");
  revalidatePath("/ha/venues");
  return { id };
}

export async function createRoom(input: {
  venueId: string;
  identifier: string;
  capacity?: number;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "venues:manage") && !hasPermission(ctx, "ha:venue_manage")) {
    throw new Error("FORBIDDEN");
  }
  const data = z
    .object({
      venueId: z.string(),
      identifier: z.string().min(1),
      capacity: z.number().optional(),
    })
    .parse(input);
  const id = createId("room");
  await db.insert(rooms).values({
    id,
    venueId: data.venueId,
    identifier: data.identifier,
    capacity: data.capacity,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "room.create",
    entityType: "room",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/venues");
  revalidatePath("/ha/venues");
  return { id };
}

export async function deleteRoom(roomId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "venues:manage") && !hasPermission(ctx, "ha:venue_manage")) {
    throw new Error("FORBIDDEN");
  }
  await db.delete(rooms).where(eq(rooms.id, roomId));
  await writeAudit({
    actorId: ctx.userId,
    action: "room.delete",
    entityType: "room",
    entityId: roomId,
  });
  revalidatePath("/admin/venues");
  revalidatePath("/ha/venues");
}
