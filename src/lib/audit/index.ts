import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { createId } from "@/lib/id";

export async function writeAudit(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditEvents).values({
    id: createId("aud"),
    actorId: params.actorId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    details: params.details ?? null,
  });
}
