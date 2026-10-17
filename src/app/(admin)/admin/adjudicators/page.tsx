import { db } from "@/db";
import { adjudicatorProfiles, user } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { AdjudicatorCreateForm } from "./adjudicator-form";
import { AdjudicatorsTable } from "./adjudicators-table";

export default async function AdjudicatorsAdminPage() {
  const profiles = await db.select().from(adjudicatorProfiles);
  const users = await db.select().from(user);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = profiles.map((p) => {
    const u = userMap.get(p.userId);
    return {
      id: p.id,
      name: u?.name ?? "—",
      email: u?.email ?? "—",
      qualifications: p.qualifications ?? "—",
      active: p.active ? "Yes" : "No",
      userId: p.userId,
      notes: p.notes,
      rawActive: p.active,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adjudicators"
        description="Profiles, availability and assignments"
        actions={<AdjudicatorCreateForm />}
      />
      <AdjudicatorsTable rows={rows} />
    </div>
  );
}
