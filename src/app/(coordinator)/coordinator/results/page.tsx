import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";

export default async function CoordinatorResultsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const teamRows =
    ids.length > 0
      ? await db.select().from(teams).where(inArray(teams.institutionId, ids))
      : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="Win/loss records for your teams" />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>W–L</TableHead>
              <TableHead>Byes</TableHead>
              <TableHead>Speaker pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamRows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="tabular-nums">
                  {t.wins}–{t.losses}
                </TableCell>
                <TableCell>{t.byes}</TableCell>
                <TableCell className="tabular-nums">{t.speakerPoints}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
