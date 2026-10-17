import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { SectionCards } from "@/components/section-cards";
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
      <SectionCards
        cards={[
          {
            label: "Institutions",
            value: institutions.length,
            hint: institutions.map((i) => i.shortName).join(", ") || "None assigned",
          },
          {
            label: "Teams",
            value: teamRows.length,
            hint: "Across your institutions",
          },
        ]}
      />
      {institutions.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {institutions.map((i) => (
            <li key={i.id} className="rounded-lg border px-4 py-3">
              <p className="font-medium">{i.name}</p>
              <p className="text-muted-foreground">{i.shortName}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
