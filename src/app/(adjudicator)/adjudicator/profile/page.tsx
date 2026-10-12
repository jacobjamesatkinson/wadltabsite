import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";

export default async function AdjudicatorProfilePage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <div className="rounded-lg border p-4 text-sm space-y-2">
        <p>
          <span className="text-muted-foreground">Name:</span> {ctx.name}
        </p>
        <p>
          <span className="text-muted-foreground">Email:</span> {ctx.email}
        </p>
        <p>
          <span className="text-muted-foreground">Qualifications:</span>{" "}
          {profile?.qualifications ?? "—"}
        </p>
      </div>
    </div>
  );
}
