import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditPage() {
  const events = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Significant administrative actions"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No audit events yet
                </TableCell>
              </TableRow>
            ) : (
              events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {e.createdAt?.toISOString().replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell>{e.action}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.entityType}
                    {e.entityId ? `:${e.entityId.slice(0, 12)}` : ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.actorId?.slice(0, 12) ?? "system"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
