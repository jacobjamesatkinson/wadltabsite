import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";

export default async function CoordinatorOverviewPage() {
  const ctx = await requireAuth();
  const instIds = institutionIdsFor(ctx);
  const institutions =
    instIds.length > 0
      ? await db.query.institutions.findMany({
          where: (t, { inArray: ia }) => ia(t.id, instIds),
        })
      : [];
  const teamRows =
    instIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.institutionId, instIds))
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordinator overview"
        description="Your institutions, teams and published draws"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Institutions</p>
          <p className="mt-2 text-3xl font-semibold">{institutions.length}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {institutions.map((i) => (
              <li key={i.id}>{i.name}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Teams</p>
          <p className="mt-2 text-3xl font-semibold">{teamRows.length}</p>
        </div>
      </div>
    </div>
  );
}
