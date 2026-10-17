import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, user } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { AuditTable } from "./audit-table";

export default async function AuditPage() {
  const [events, users] = await Promise.all([
    db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(200),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Significant administrative actions"
      />
      <AuditTable
        rows={events.map((e) => ({
          id: e.id,
          when: e.createdAt.toLocaleString("en-AU"),
          action: e.action,
          entity: e.entityId
            ? `${e.entityType}:${e.entityId}`
            : e.entityType,
          actor: e.actorId ? names.get(e.actorId) ?? e.actorId : "—",
        }))}
      />
    </div>
  );
}
