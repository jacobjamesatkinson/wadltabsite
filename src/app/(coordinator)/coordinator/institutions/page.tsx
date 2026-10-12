import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";

export default async function CoordinatorInstitutionsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const rows =
    ids.length > 0
      ? await db.query.institutions.findMany({
          where: (t, { inArray }) => inArray(t.id, ids),
        })
      : [];

  return (
    <div className="space-y-6">
      <PageHeader title="My institutions" />
      <ul className="space-y-2">
        {rows.map((i) => (
          <li key={i.id} className="rounded-lg border px-4 py-3">
            <p className="font-medium">{i.name}</p>
            <p className="text-sm text-muted-foreground">{i.shortName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
