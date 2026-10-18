import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { PublicDrawListings } from "@/app/public/draw/public-draw-listings";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";
import { loadPublicDrawData } from "@/lib/public-draw";

export default async function CoordinatorDrawPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const [institutionRows, { rows, roundMenus }] = await Promise.all([
    ids.length > 0
      ? db.select().from(institutions).where(inArray(institutions.id, ids))
      : Promise.resolve([]),
    loadPublicDrawData(),
  ]);
  const lockedInstitutions = institutionRows.map((i) => i.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution draw"
        description="Published debates for your institutions"
      />
      {lockedInstitutions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No institutions are linked to your account
        </div>
      ) : (
        <PublicDrawListings
          rows={rows}
          roundMenus={roundMenus}
          currentRound={sp.round}
          roundBasePath="/coordinator/draw"
          lockedInstitutions={lockedInstitutions}
        />
      )}
    </div>
  );
}
